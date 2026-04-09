/**
 * Inventory: stock levels, movements, negative stock, and reorder settings.
 * @openapi
 * tags:
 *   - name: Inventory
 *     description: On-hand levels, movements, and reorder configuration
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { PO_STATUS_EXCLUDE_FROM_EXPECTED } from '../lib/purchaseOrderStatus';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

/**
 * @openapi
 * /inventory/levels:
 *   get:
 *     summary: List inventory levels (paginated)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         description: Page size (alias limit)
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *       - in: query
 *         name: locationId
 *         schema: { type: string }
 *       - in: query
 *         name: variantId
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Paginated rows per variant; each row has levels[] (per-location) and totals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       variantId: { type: string }
 *                       variant: { type: object }
 *                       levels:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             locationId: { type: string }
 *                             location: { type: object }
 *                             onHand: { type: number }
 *                             committed: { type: number, description: Unfulfilled SO qty (open orders only, excludes draft) }
 *                             available: { type: number, description: onHand minus committed minus allocated }
 *                       totalOnHand: { type: number }
 *                       totalCommitted: { type: number }
 *                       totalAvailable: { type: number }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/levels', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.locationId) where.locationId = req.query.locationId;
  if (req.query.variantId) where.variantId = req.query.variantId;

  const variantGroups = await prisma.inventoryLevel.groupBy({
    by: ['variantId'],
    where,
    orderBy: { variantId: 'asc' },
  });
  const totalVariants = variantGroups.length;
  const pageGroups = variantGroups.slice(skip, skip + take);
  const pageVariantIds = pageGroups.map((g) => g.variantId);

  if (!pageVariantIds.length) {
    res.json(paginated([], totalVariants, page, pageSize));
    return;
  }

  const items = await prisma.inventoryLevel.findMany({
    where: { ...where, variantId: { in: pageVariantIds } },
    include: {
      variant: { include: { product: true } },
      location: true,
    },
    orderBy: [{ variantId: 'asc' }, { locationId: 'asc' }],
  });

  const defaultLoc =
    (await prisma.location.findFirst({ where: { isDefault: true } })) ??
    (await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } }));

  /** Same “open” SO set as list filter: exclude draft, fulfilled, cancelled */
  const soRows = await prisma.salesOrderRow.findMany({
    where: {
      order: {
        status: { notIn: ['cancelled', 'fulfilled', 'draft'] },
      },
      variantId: { not: null },
    },
    select: {
      variantId: true,
      qtyOrdered: true,
      qtyFulfilled: true,
      qtyPicked: true,
      locationId: true,
      order: { select: { locationId: true } },
    },
  });

  /** SO demand not yet picked (per variant+location). */
  const committedFromSalesOrdersMap: Record<string, number> = {};
  for (const r of soRows) {
    const locId = r.locationId ?? r.order.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const openQty = Math.max(
      0,
      Number(r.qtyOrdered) - Number(r.qtyFulfilled || 0) - Number((r as any).qtyPicked || 0),
    );
    if (openQty <= 0) continue;
    const key = `${r.variantId}|${locId}`;
    committedFromSalesOrdersMap[key] = (committedFromSalesOrdersMap[key] || 0) + openQty;
  }

  /** MO component demand not yet consumed (per variant+MO location). */
  const moRows = await prisma.mORecipeRow.findMany({
    where: {
      variantId: { in: pageVariantIds },
      mo: { status: { notIn: ['draft', 'completed', 'cancelled', 'done', 'closed'] } },
    },
    select: {
      variantId: true,
      qtyPlanned: true,
      qtyConsumed: true,
      mo: { select: { locationId: true } },
    },
  });
  const committedFromManufacturingOrdersMap: Record<string, number> = {};
  for (const r of moRows) {
    const locId = r.mo.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const openMo = Math.max(0, Number(r.qtyPlanned) - Number(r.qtyConsumed || 0));
    if (openMo <= 0) continue;
    const key = `${r.variantId}|${locId}`;
    committedFromManufacturingOrdersMap[key] =
      (committedFromManufacturingOrdersMap[key] || 0) + openMo;
  }

  /** Transfer demand from source locations for open transfer orders. */
  const toRows = await prisma.stockTransfer.findMany({
    where: {
      variantId: { in: pageVariantIds },
      status: { notIn: ['completed', 'cancelled', 'done', 'closed'] },
    },
    select: { variantId: true, fromLocationId: true, qty: true },
  });
  const committedFromTransferOrdersMap: Record<string, number> = {};
  for (const r of toRows) {
    const locId = r.fromLocationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const openTo = Math.max(0, Number(r.qty || 0));
    if (openTo <= 0) continue;
    const key = `${r.variantId}|${locId}`;
    committedFromTransferOrdersMap[key] = (committedFromTransferOrdersMap[key] || 0) + openTo;
  }

  /** Open PO lines: qty still expected at the PO destination location (informational; does not change `available`). */
  const poRows = await prisma.purchaseOrderRow.findMany({
    where: {
      variantId: { in: pageVariantIds },
      order: { status: { notIn: [...PO_STATUS_EXCLUDE_FROM_EXPECTED] } },
    },
    select: {
      variantId: true,
      qtyOrdered: true,
      qtyReceived: true,
      order: { select: { locationId: true } },
    },
  });
  const poExpectedMap: Record<string, number> = {};
  for (const r of poRows) {
    const locId = r.order.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const openPo = Math.max(0, Number(r.qtyOrdered) - Number(r.qtyReceived || 0));
    if (openPo <= 0) continue;
    const key = `${r.variantId}|${locId}`;
    poExpectedMap[key] = (poExpectedMap[key] || 0) + openPo;
  }

  const byVariant = new Map<string, any[]>();
  for (const l of items) {
    const arr = byVariant.get(l.variantId) || [];
    arr.push(l);
    byVariant.set(l.variantId, arr);
  }

  const rows = pageVariantIds.map((variantId) => {
    const levelsRaw = byVariant.get(variantId) || [];
    const first = levelsRaw[0];
    const levels = levelsRaw.map((l: any) => {
      const key = `${l.variantId}|${l.locationId}`;
      const allocated = Number(l.allocated || 0);
      const committedSalesOrder = committedFromSalesOrdersMap[key] || 0;
      const committedManufacturingOrder = committedFromManufacturingOrdersMap[key] || 0;
      const committedTransferOrder = committedFromTransferOrdersMap[key] || 0;
      const committedRaw =
        committedSalesOrder + committedManufacturingOrder + committedTransferOrder;
      const committed = Math.max(0, committedRaw - allocated);
      const expected = poExpectedMap[key] || 0;
      const onHand = Number(l.onHand);
      return {
        id: l.id,
        locationId: l.locationId,
        location: l.location ? { id: l.location.id, name: l.location.name } : null,
        onHand,
        allocated,
        committed,
        committedSalesOrder,
        committedManufacturingOrder,
        committedTransferOrder,
        committedRaw,
        expected,
        /** Free to allocate: on hand − committed − allocated. */
        available: onHand - committed - allocated,
        reorderPoint: l.reorderPoint != null ? Number(l.reorderPoint) : null,
        reorderQty: l.reorderQty != null ? Number(l.reorderQty) : null,
        safetyStock: l.safetyStock != null ? Number(l.safetyStock) : null,
      };
    });
    levels.sort((a, b) => (a.location?.name || '').localeCompare(b.location?.name || ''));

    const totalOnHand = levels.reduce((s, x) => s + x.onHand, 0);
    const totalAllocated = levels.reduce((s, x) => s + x.allocated, 0);
    const totalCommitted = levels.reduce((s, x) => s + x.committed, 0);
    const totalCommittedSalesOrder = levels.reduce((s, x) => s + x.committedSalesOrder, 0);
    const totalCommittedManufacturingOrder = levels.reduce(
      (s, x) => s + x.committedManufacturingOrder,
      0,
    );
    const totalCommittedTransferOrder = levels.reduce((s, x) => s + x.committedTransferOrder, 0);
    const totalExpected = levels.reduce((s, x) => s + x.expected, 0);
    const totalAvailable = levels.reduce((s, x) => s + x.available, 0);

    return {
      variantId,
      variant: first?.variant ?? null,
      levels,
      totalOnHand,
      totalAllocated,
      totalCommitted,
      totalCommittedSalesOrder,
      totalCommittedManufacturingOrder,
      totalCommittedTransferOrder,
      totalExpected,
      totalAvailable,
      /** Backward compatibility aliases */
      totalPicked: totalAllocated,
      totalSalesOrderCommitted: totalCommittedSalesOrder,
      totalPurchaseOrderExpected: totalExpected,
    };
  });

  res.json(paginated(rows, totalVariants, page, pageSize));
});

/**
 * Drill-down demand/expecation details for one variant.
 * Optional locationId filters rows to a specific site.
 */
router.get('/levels/:variantId/demand-details', async (req, res) => {
  const { variantId } = z.object({ variantId: z.string().min(1) }).parse(req.params);
  const { locationId } = z
    .object({ locationId: z.string().min(1).optional() })
    .parse(req.query);

  const defaultLoc =
    (await prisma.location.findFirst({ where: { isDefault: true } })) ??
    (await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } }));

  const allLocations = await prisma.location.findMany({
    select: { id: true, name: true },
  });
  const locNameById = new Map(allLocations.map((l) => [l.id, l.name]));

  const soRows = await prisma.salesOrderRow.findMany({
    where: {
      variantId,
      order: { status: { notIn: ['cancelled', 'fulfilled', 'draft'] } },
    },
    select: {
      id: true,
      qtyOrdered: true,
      qtyFulfilled: true,
      qtyPicked: true,
      locationId: true,
      order: {
        select: {
          id: true,
          number: true,
          status: true,
          locationId: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });
  const salesOrders = soRows
    .map((r: any) => {
      const resolvedLocationId = r.locationId ?? r.order.locationId ?? defaultLoc?.id ?? null;
      const demandQty = Math.max(
        0,
        Number(r.qtyOrdered) - Number(r.qtyFulfilled || 0) - Number(r.qtyPicked || 0),
      );
      return {
        salesOrderId: r.order.id,
        salesOrderNumber: r.order.number,
        status: r.order.status,
        customerName: r.order.customer?.name ?? null,
        rowId: r.id,
        locationId: resolvedLocationId,
        locationName: resolvedLocationId ? locNameById.get(resolvedLocationId) ?? null : null,
        demandQty,
      };
    })
    .filter((x: any) => x.demandQty > 0)
    .filter((x: any) => (locationId ? x.locationId === locationId : true));

  const salesOrderAllocations = soRows
    .map((r: any) => {
      const resolvedLocationId = r.locationId ?? r.order.locationId ?? defaultLoc?.id ?? null;
      const allocatedQty = Math.max(0, Number(r.qtyPicked || 0));
      return {
        salesOrderId: r.order.id,
        salesOrderNumber: r.order.number,
        status: r.order.status,
        customerName: r.order.customer?.name ?? null,
        rowId: r.id,
        locationId: resolvedLocationId,
        locationName: resolvedLocationId ? locNameById.get(resolvedLocationId) ?? null : null,
        allocatedQty,
      };
    })
    .filter((x: any) => x.allocatedQty > 0)
    .filter((x: any) => (locationId ? x.locationId === locationId : true));

  const moRows = await prisma.mORecipeRow.findMany({
    where: {
      variantId,
      mo: { status: { notIn: ['draft', 'completed', 'cancelled', 'done', 'closed'] } },
    },
    select: {
      id: true,
      qtyPlanned: true,
      qtyConsumed: true,
      mo: { select: { id: true, number: true, status: true, locationId: true } },
    },
  });
  const manufacturingOrders = moRows
    .map((r: any) => {
      const resolvedLocationId = r.mo.locationId ?? defaultLoc?.id ?? null;
      const demandQty = Math.max(0, Number(r.qtyPlanned) - Number(r.qtyConsumed || 0));
      return {
        manufacturingOrderId: r.mo.id,
        manufacturingOrderNumber: r.mo.number,
        status: r.mo.status,
        recipeRowId: r.id,
        locationId: resolvedLocationId,
        locationName: resolvedLocationId ? locNameById.get(resolvedLocationId) ?? null : null,
        demandQty,
      };
    })
    .filter((x: any) => x.demandQty > 0)
    .filter((x: any) => (locationId ? x.locationId === locationId : true));

  const toRows = await prisma.stockTransfer.findMany({
    where: {
      variantId,
      status: { notIn: ['completed', 'cancelled', 'done', 'closed'] },
    },
    select: { id: true, status: true, qty: true, fromLocationId: true, toLocationId: true },
  });
  const transferOrders = toRows
    .map((r: any) => ({
      transferOrderId: r.id,
      transferOrderNumber: `TO-${String(r.id).slice(0, 8)}`,
      status: r.status,
      fromLocationId: r.fromLocationId,
      fromLocationName: locNameById.get(r.fromLocationId) ?? null,
      toLocationId: r.toLocationId,
      toLocationName: locNameById.get(r.toLocationId) ?? null,
      demandQty: Math.max(0, Number(r.qty || 0)),
    }))
    .filter((x: any) => x.demandQty > 0)
    .filter((x: any) => (locationId ? x.fromLocationId === locationId : true));

  const poRows = await prisma.purchaseOrderRow.findMany({
    where: {
      variantId,
      order: { status: { notIn: [...PO_STATUS_EXCLUDE_FROM_EXPECTED] } },
    },
    select: {
      id: true,
      qtyOrdered: true,
      qtyReceived: true,
      order: {
        select: {
          id: true,
          number: true,
          status: true,
          locationId: true,
          supplier: { select: { id: true, name: true } },
        },
      },
    },
  });
  const purchaseOrders = poRows
    .map((r: any) => {
      const resolvedLocationId = r.order.locationId ?? defaultLoc?.id ?? null;
      const expectedQty = Math.max(0, Number(r.qtyOrdered) - Number(r.qtyReceived || 0));
      return {
        purchaseOrderId: r.order.id,
        purchaseOrderNumber: r.order.number,
        status: r.order.status,
        supplierName: r.order.supplier?.name ?? null,
        rowId: r.id,
        locationId: resolvedLocationId,
        locationName: resolvedLocationId ? locNameById.get(resolvedLocationId) ?? null : null,
        expectedQty,
      };
    })
    .filter((x: any) => x.expectedQty > 0)
    .filter((x: any) => (locationId ? x.locationId === locationId : true));

  res.json({
    variantId,
    locationId: locationId ?? null,
    salesOrderAllocations,
    salesOrders,
    manufacturingOrders,
    transferOrders,
    purchaseOrders,
    totals: {
      allocated: salesOrderAllocations.reduce((s: number, x: any) => s + Number(x.allocatedQty), 0),
      salesOrders: salesOrders.reduce((s: number, x: any) => s + Number(x.demandQty), 0),
      manufacturingOrders: manufacturingOrders.reduce((s: number, x: any) => s + Number(x.demandQty), 0),
      transferOrders: transferOrders.reduce((s: number, x: any) => s + Number(x.demandQty), 0),
      committed:
        salesOrders.reduce((s: number, x: any) => s + Number(x.demandQty), 0) +
        manufacturingOrders.reduce((s: number, x: any) => s + Number(x.demandQty), 0) +
        transferOrders.reduce((s: number, x: any) => s + Number(x.demandQty), 0),
      expected: purchaseOrders.reduce((s: number, x: any) => s + Number(x.expectedQty), 0),
    },
  });
});

/**
 * @openapi
 * /inventory/movements:
 *   get:
 *     summary: List inventory movements (paginated, newest first)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *       - in: query
 *         name: variantId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: locationId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Paginated movements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/movements', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.variantId) where.variantId = req.query.variantId;
  if (req.query.locationId) where.locationId = req.query.locationId;
  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        variant: { include: { product: true } },
        location: true,
      },
    }),
    prisma.inventoryMovement.count({ where })
  ]);
  res.json(paginated(items, total, page, pageSize));
});

// POST /inventory/reorder_points — set reorder point for a variant+location
/**
 * @openapi
 * /inventory/reorder-points:
 *   post:
 *     summary: Set or update reorder point for a variant at a location
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [variantId, locationId, reorderPoint]
 *             properties:
 *               variantId: { type: string, format: uuid }
 *               locationId: { type: string, format: uuid }
 *               reorderPoint: { type: number, minimum: 0 }
 *     responses:
 *       '200':
 *         description: Upserted inventory level
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/reorder-points', async (req, res) => {
  const { variantId, locationId, reorderPoint } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    reorderPoint: z.coerce.number().min(0),
  }).parse(req.body);

  const item = await prisma.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, reorderPoint, onHand: 0, allocated: 0 },
    update: { reorderPoint },
  });
  res.json(item);
});

// POST /inventory/safety_stock_levels — set reorder qty (safety stock) for a variant+location
/**
 * @openapi
 * /inventory/safety-stock:
 *   post:
 *     summary: Set or update safety stock (reorder quantity) for a variant at a location
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [variantId, locationId, reorderQty]
 *             properties:
 *               variantId: { type: string, format: uuid }
 *               locationId: { type: string, format: uuid }
 *               reorderQty: { type: number, minimum: 0 }
 *     responses:
 *       '200':
 *         description: Upserted inventory level
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/safety-stock', async (req, res) => {
  const { variantId, locationId, reorderQty } = z.object({
    variantId: z.string().uuid(),
    locationId: z.string().uuid(),
    reorderQty: z.coerce.number().min(0),
  }).parse(req.body);

  const item = await prisma.inventoryLevel.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    create: { variantId, locationId, reorderQty, onHand: 0, allocated: 0 },
    update: { reorderQty },
  });
  res.json(item);
});

// GET /inventory/negative_stock — variants with onHand < 0
/**
 * @openapi
 * /inventory/negative-stock:
 *   get:
 *     summary: List inventory levels with negative on-hand (paginated)
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated levels including variant, product, and location
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { type: object } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     hasNext: { type: boolean }
 *                     totalPages: { type: integer }
 */
router.get('/negative-stock', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where = { onHand: { lt: 0 } };
  const [items, total] = await Promise.all([
    prisma.inventoryLevel.findMany({ where, include: { variant: { include: { product: true } }, location: true }, skip, take, orderBy: { onHand: 'asc' } }),
    prisma.inventoryLevel.count({ where }),
  ]);
  res.json(paginated(items, total, page, pageSize));
});

export default router;
