/**
 * Sales orders: listing, CRUD, line items, fulfillment, and returnable quantities.
 * @openapi
 * tags:
 *   - name: SalesOrders
 *     description: Customer sales orders and fulfillment
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock, adjustVariantStockWithBatch, restoreVariantStockWithBatch } from '../lib/inventory';
import { nextSalesOrderNumber } from '../lib/nextSalesOrderNumber';
import { z } from 'zod';
import soAddressesRouter from './soAddresses';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

const rowInclude = {
  fulfillments: true,
  location: { select: { id: true, name: true } },
} as const;

const includeList = {
  customer: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  rows: { include: rowInclude },
};

async function appendPipelineStatuses(sos: any[]) {
  if (!sos.length) return sos;
  const variantMap = new Set<string>();
  const locationIdSet = new Set<string>();
  sos.forEach(so => {
    if (so.locationId) locationIdSet.add(so.locationId);
    so.rows?.forEach((r: any) => {
      if (r.variantId) variantMap.add(r.variantId);
    });
  });

  const variantIds = Array.from(variantMap);
  const locationIds = Array.from(locationIdSet);

  const levels = await prisma.inventoryLevel.findMany({
    where: { variantId: { in: variantIds }, locationId: { in: locationIds } }
  });
  
  const poRows = await prisma.purchaseOrderRow.findMany({
    where: { variantId: { in: variantIds }, order: { status: { notIn: ['cancelled', 'received'] } } },
    select: { variantId: true, qtyOrdered: true, qtyReceived: true, order: { select: { locationId: true } } }
  });

  const onHandMap: Record<string, number> = {};
  levels.forEach(l => { onHandMap[`${l.variantId}|${l.locationId}`] = Number(l.onHand); });
  
  const expectedMap: Record<string, number> = {};
  poRows.forEach(r => {
    const locId = r.order.locationId;
    if (!locId || !r.variantId) return;
    const key = `${r.variantId}|${locId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  });

  return sos.map(so => {
    let sumOrdered = 0;
    let sumFulfilled = 0;
    let allAvailable = true;
    let anyNotAvailable = false;
    let anyExpected = false;

    so.rows?.forEach((r: any) => {
      const qO = Number(r.qtyOrdered);
      const qF = Number(r.qtyFulfilled || 0);
      sumOrdered += qO;
      sumFulfilled += qF;

      if (!r.variantId || !so.locationId) return;
      const key = `${r.variantId}|${so.locationId}`;
      const onHand = onHandMap[key] || 0;
      const expected = expectedMap[key] || 0;
      const remainingReq = qO - qF;

      if (remainingReq > 0) {
        if (onHand >= remainingReq) {
          // available
        } else if (onHand + expected >= remainingReq) {
          anyExpected = true;
          allAvailable = false;
        } else {
          anyNotAvailable = true;
          allAvailable = false;
        }
      }
    });

    let deliveryStatus = 'not_shipped';
    if (sumFulfilled >= sumOrdered && sumOrdered > 0) deliveryStatus = 'shipped';
    else if (sumFulfilled > 0) deliveryStatus = 'partially_shipped';

    let salesItemsStatus = 'expected';
    if (anyNotAvailable) salesItemsStatus = 'not_available';
    else if (allAvailable) salesItemsStatus = 'available';

    return { ...so, deliveryStatus, salesItemsStatus };
  });
}

const includeDetail = {
  customer: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  rows: { include: rowInclude },
  fulfillments: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      location: { select: { id: true, name: true } },
      row: { select: { id: true, description: true } },
      batch: { select: { id: true, batchNumber: true, expiryDate: true } },
    },
  },
};

/** Parse YYYY-MM-DD for @db.Date without local-TZ drift */
function parseDueDate(input: string | null | undefined): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === '') return null;
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(input);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

async function buildSoRowLookups(rows: any[]) {
  const variantIds = Array.from(new Set((rows || []).map((r: any) => r.variantId).filter(Boolean)));
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          product: { select: { id: true, name: true, trackLotsAndExpiry: true } },
        },
      })
    : [];
  return { variantById: new Map(variants.map((v: any) => [v.id, v])) };
}

function normalizeSo(so: any, lookups?: { variantById: Map<string, any> }) {
  return {
    ...so,
    soNumber: so.number,
    dueAt: so.requiredDate,
    deliveryStatus: so.deliveryStatus || 'not_shipped',
    salesItemsStatus: so.salesItemsStatus || 'available',
    totalPrice: so.rows?.reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0) ?? 0,
    rows: so.rows?.map((r: any) => {
      const v = r.variant ?? (r.variantId && lookups ? lookups.variantById.get(r.variantId) || null : null);
      return {
        ...r,
        qty: r.qtyOrdered,
        salePrice: r.unitPrice,
        fulfilledQty: r.qtyFulfilled,
        variant: v,
        trackLotsAndExpiry: Boolean(v?.product?.trackLotsAndExpiry),
      };
    }),
  };
}

/** On-hand / allocated / available at the line’s location (row override → order default → all sites). */
async function attachLineInventoryToRows(soRaw: any, rows: any[]): Promise<any[]> {
  const variantIds = [...new Set(rows.map((r: any) => r.variantId).filter(Boolean))] as string[];
  if (!variantIds.length) {
    return rows.map((r) => ({ ...r, stockAtLineLocation: null }));
  }

  const levels = await prisma.inventoryLevel.findMany({
    where: { variantId: { in: variantIds } },
    include: { location: { select: { id: true, name: true } } },
  });
  const key = (v: string, l: string) => `${v}:${l}`;
  const byKey = new Map(levels.map((lv: any) => [key(lv.variantId, lv.locationId), lv]));
  const byVariant = new Map<string, any[]>();
  for (const lv of levels) {
    const arr = byVariant.get(lv.variantId) || [];
    arr.push(lv);
    byVariant.set(lv.variantId, arr);
  }

  return rows.map((r: any) => {
    const vid = r.variantId;
    if (!vid) return { ...r, stockAtLineLocation: null };

    const effLoc: string | null = r.locationId ?? soRaw.locationId ?? null;
    if (effLoc) {
      const lv = byKey.get(key(vid, effLoc));
      const onH = lv ? Number(lv.onHand) : 0;
      const alc = lv ? Number(lv.allocated) : 0;
      let locName: string | null = null;
      if (r.locationId && r.location?.name) locName = r.location.name;
      else if (!r.locationId && soRaw.locationId === effLoc && soRaw.location?.name) locName = soRaw.location.name;
      else locName = lv?.location?.name ?? null;
      return {
        ...r,
        stockAtLineLocation: {
          locationId: effLoc,
          locationName: locName,
          onHand: onH,
          allocated: alc,
          available: Math.max(0, onH - alc),
        },
      };
    }

    const all = byVariant.get(vid) || [];
    const onHand = all.reduce((s, x) => s + Number(x.onHand), 0);
    const allocated = all.reduce((s, x) => s + Number(x.allocated), 0);
    return {
      ...r,
      stockAtLineLocation: {
        locationId: null,
        locationName: null,
        onHand,
        allocated,
        available: Math.max(0, onHand - allocated),
        scope: 'all_locations' as const,
      },
    };
  });
}

async function respondSalesOrder(so: any) {
  const enriched = await appendPipelineStatuses([so]);
  const lookups = await buildSoRowLookups(enriched[0].rows || []);
  const normalized = normalizeSo(enriched[0], lookups);
  normalized.rows = await attachLineInventoryToRows(enriched[0], normalized.rows || []);
  return normalized;
}

/**
 * @openapi
 * /sales-orders:
 *   get:
 *     summary: List sales orders (paginated)
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 250 }
 *     responses:
 *       '200':
 *         description: Paginated normalized sales orders (soNumber, rows with qty/salePrice, etc.)
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
router.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const where: any = {};
  if (req.query.status === 'open') {
    // Open = active pipeline (exclude draft, fulfilled, cancelled)
    where.NOT = {
      OR: [
        { status: { equals: 'fulfilled', mode: 'insensitive' } },
        { status: { equals: 'cancelled', mode: 'insensitive' } },
        { status: { equals: 'draft', mode: 'insensitive' } },
      ],
    };
  } else if (req.query.status === 'done') {
    // Done = shipped or manually closed
    where.OR = [
      { status: { equals: 'fulfilled', mode: 'insensitive' } },
      { status: { equals: 'cancelled', mode: 'insensitive' } },
    ];
  } else if (req.query.status) {
    where.status = { equals: String(req.query.status).trim(), mode: 'insensitive' };
  }
  const locFilter = req.query.locationId && String(req.query.locationId).trim();
  if (locFilter) {
    const lid = String(locFilter);
    where.AND = [...(where.AND ?? []), {
      OR: [{ locationId: lid }, { rows: { some: { locationId: lid } } }],
    }];
  }
  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({ where, include: includeList, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrder.count({ where }),
  ]);
  const enriched = await appendPipelineStatuses(items);
  const lookups = await buildSoRowLookups(enriched.flatMap((so: any) => so.rows || []));
  res.json(paginated(enriched.map((so: any) => normalizeSo(so, lookups)), total, page, pageSize));
});

/**
 * @openapi
 * /sales-orders:
 *   post:
 *     summary: Create a sales order with optional line rows
 *     tags: [SalesOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number: { type: string }
 *               customerId: { type: string, format: uuid, nullable: true }
 *               currency: { type: string, default: USD }
 *               dueAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *               rows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variantId: { type: string, format: uuid, nullable: true }
 *                     description: { type: string, nullable: true }
 *                     qty: { type: number }
 *                     qtyOrdered: { type: number }
 *                     salePrice: { type: number, nullable: true }
 *                     unitPrice: { type: number, nullable: true }
 *     responses:
 *       '201':
 *         description: Created sales order (normalized)
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    customerId: z.string().uuid(),
    currency: z.string().default('USD'),
    dueAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().uuid().nullish(),
    rows: z.array(
      z.object({
        variantId: z.string().uuid().nullish(),
        description: z.string().nullish(),
        qty: z.coerce.number().optional().default(1),
        qtyOrdered: z.coerce.number().optional(),
        salePrice: z.coerce.number().nullish(),
        unitPrice: z.coerce.number().nullish(),
        locationId: z.string().uuid().nullish(),
      }).refine((r) => (r.qtyOrdered ?? r.qty) > 0, { message: 'Quantity must be greater than 0', path: ['qty'] }),
    ).default([]),
  }).parse(req.body);
  if (data.dueAt) {
    const y = Number(String(data.dueAt).slice(0, 4));
    if (Number.isFinite(y) && (y < 2000 || y > 2100)) {
      return res.status(422).json({ error: 'Due date year must be between 2000 and 2100' });
    }
  }
  const number = data.number || (await nextSalesOrderNumber());
  const so = await prisma.salesOrder.create({
    data: {
      number, customerId: data.customerId, currency: data.currency,
      requiredDate: data.dueAt ? parseDueDate(data.dueAt) ?? undefined : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: {
        create: data.rows.map(r => ({
          variantId: r.variantId ?? undefined,
          description: r.description ?? undefined,
          qtyOrdered: r.qtyOrdered ?? r.qty,
          unitPrice: r.unitPrice ?? r.salePrice ?? undefined,
          locationId: r.locationId ?? undefined,
        })),
      },
    },
    include: includeList,
  });
  res.status(201).json(await respondSalesOrder(so));
});

/**
 * @openapi
 * /sales-orders/{id}:
 *   get:
 *     summary: Get a sales order by id
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Normalized sales order
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include: includeDetail });
  if (!so) return res.status(404).json({ error: 'Not found' });
  res.json(await respondSalesOrder(so));
});

async function updateSoById(req: any, res: any) {
  const existing = await prisma.salesOrder.findUnique({
    where: { id: req.params.id },
    include: { rows: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const data = z.object({
    customerId: z.string().uuid().nullish(), status: z.string().nullish(),
    currency: z.string().nullish(), dueAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().uuid().nullish(),
  }).partial().parse(req.body);
  if (data.dueAt) {
    const y = Number(String(data.dueAt).slice(0, 4));
    if (Number.isFinite(y) && (y < 2000 || y > 2100)) {
      return res.status(422).json({ error: 'Due date year must be between 2000 and 2100' });
    }
  }
  if (data.customerId === null && String(existing.status).toLowerCase() !== 'draft') {
    return res.status(422).json({ error: 'Cannot remove the customer unless the order is in Draft status.' });
  }

  if (data.status !== undefined && data.status !== existing.status) {
    const newSt = String(data.status).toLowerCase();
    const hasFulfillmentQty = (existing.rows || []).some((r: any) => Number(r.qtyFulfilled) > 0);
    if (hasFulfillmentQty && (newSt === 'draft' || newSt === 'confirmed')) {
      return res.status(422).json({
        error: 'Cannot set status to draft or confirmed while lines have fulfilled quantity. Use Revert fulfillment first.',
      });
    }
    if (newSt === 'fulfilled') {
      const rows = existing.rows || [];
      const incomplete = rows.some(
        (r: any) => Number(r.qtyOrdered) > 0 && Number(r.qtyFulfilled) < Number(r.qtyOrdered),
      );
      if (incomplete) {
        return res.status(422).json({ error: 'Cannot mark fulfilled until every line with quantity is fully fulfilled.' });
      }
    }
  }

  const soData: any = {};
  if (data.customerId !== undefined) soData.customerId = data.customerId;
  if (data.status) soData.status = data.status;
  if (data.currency) soData.currency = data.currency;
  if (data.notes !== undefined) soData.notes = data.notes;
  if (data.locationId !== undefined) soData.locationId = data.locationId;
  if (data.dueAt !== undefined) soData.requiredDate = data.dueAt ? parseDueDate(data.dueAt) : null;
  const so = await prisma.salesOrder.update({ where: { id: req.params.id }, data: soData, include: includeDetail });
  res.json(await respondSalesOrder(so));
}

/**
 * @openapi
 * /sales-orders/{id}:
 *   put:
 *     summary: Replace/update sales order header fields
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, nullable: true }
 *               currency: { type: string, nullable: true }
 *               dueAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated sales order
 *         content:
 *           application/json:
 *             schema: { type: object }
 *   patch:
 *     summary: Partially update sales order header fields
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, nullable: true }
 *               currency: { type: string, nullable: true }
 *               dueAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated sales order
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.put('/:id', updateSoById);
router.patch('/:id', updateSoById);

/**
 * Restore stock from outbound fulfillments, remove those fulfillment rows, recompute line qty & status.
 */
router.post('/:id/revert-fulfillment', async (req, res) => {
  const orderId = req.params.id;
  const so = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { rows: true },
  });
  if (!so) return res.status(404).json({ error: 'Not found' });

  const outbound = await prisma.salesOrderFulfillment.findMany({
    where: { orderId, isReturn: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!outbound.length) {
    return res.status(422).json({ error: 'No outbound fulfillments to revert.' });
  }

  await prisma.$transaction(async (tx: any) => {
    for (const f of outbound) {
      if (!f.locationId) continue;
      const row = so.rows.find((r: any) => r.id === f.rowId);
      if (!row?.variantId) continue;
      const q = Number(f.qty);
      if (q <= 0) continue;
      const revNote = {
        referenceType: 'sales_order' as const,
        referenceId: so.id,
        note: `Revert ${so.number}`,
      };
      if (f.batchId) {
        await restoreVariantStockWithBatch(
          tx,
          { variantId: row.variantId, locationId: f.locationId, qty: q, batchId: f.batchId },
          revNote,
        );
      } else {
        await adjustStock(tx, row.variantId, f.locationId, q, 'so_fulfillment_reversal', revNote);
      }
    }
    await tx.salesOrderFulfillment.deleteMany({ where: { orderId, isReturn: false } });
    const remaining = await tx.salesOrderFulfillment.findMany({ where: { orderId } });
    const sumByRow = new Map<string, number>();
    for (const f of remaining) {
      sumByRow.set(f.rowId, (sumByRow.get(f.rowId) || 0) + Number(f.qty));
    }
    for (const row of so.rows) {
      await tx.salesOrderRow.update({
        where: { id: row.id },
        data: { qtyFulfilled: sumByRow.get(row.id) || 0 },
      });
    }
    const rowsAfter = await tx.salesOrderRow.findMany({ where: { orderId } });
    const allFulfilled = rowsAfter.every(
      (r: any) => Number(r.qtyOrdered) <= 0 || Number(r.qtyFulfilled) >= Number(r.qtyOrdered),
    );
    const anyFulfilled = rowsAfter.some((r: any) => Number(r.qtyFulfilled) > 0);
    const newStatus = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partial' : 'confirmed';
    await tx.salesOrder.update({ where: { id: orderId }, data: { status: newStatus } });
  });

  const updated = await prisma.salesOrder.findUnique({ where: { id: orderId }, include: includeDetail });
  res.json(await respondSalesOrder(updated!));
});

router.delete('/:id', async (req, res) => {
  const so = await prisma.salesOrder.findUnique({
    where: { id: req.params.id },
    include: { rows: true },
  });
  if (!so) return res.status(404).json({ error: 'Not found' });
  const hasFulfilled = (so.rows || []).some((r: any) => Number(r.qtyFulfilled) > 0);
  if (hasFulfilled) {
    return res.status(422).json({
      error: 'Cannot delete an order with fulfilled lines. Revert fulfillment first.',
    });
  }
  await prisma.salesOrder.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

/**
 * @openapi
 * /sales-orders/{id}/rows:
 *   post:
 *     summary: Add a line item to a sales order
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               variantId: { type: string, format: uuid, nullable: true }
 *               description: { type: string, nullable: true }
 *               qty: { type: number, default: 1 }
 *               salePrice: { type: number, nullable: true }
 *     responses:
 *       '201':
 *         description: Created row (qty maps from qtyOrdered)
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/:id/rows', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().positive({ message: 'Quantity must be greater than 0' }),
    salePrice: z.coerce.number().nullish(),
    locationId: z.string().min(1).nullish(),
  }).parse(req.body);
  const row = await prisma.salesOrderRow.create({
    data: {
      orderId: req.params.id,
      variantId: data.variantId ?? undefined,
      description: data.description ?? undefined,
      qtyOrdered: data.qty,
      unitPrice: data.salePrice ?? undefined,
      locationId: data.locationId ?? undefined,
    },
    include: { location: { select: { id: true, name: true } } },
  });
  res.status(201).json({ ...row, qty: row.qtyOrdered, salePrice: row.unitPrice });
});

router.patch('/:id/rows/:rowId', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(),
    description: z.string().nullish(),
    qty: z.coerce.number().positive().optional(),
    salePrice: z.coerce.number().nullish(),
    locationId: z.string().min(1).nullish(),
  }).partial().parse(req.body);

  const row = await prisma.salesOrderRow.findUnique({ where: { id: req.params.rowId } });
  if (!row) return res.status(404).json({ error: 'Line not found' });

  if (Number(row.qtyFulfilled) > 0) {
    return res.status(422).json({ error: 'Cannot edit a line that has already been fulfilled.' });
  }

  const updateData: any = {};
  if (data.variantId !== undefined) updateData.variantId = data.variantId ?? null;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.qty !== undefined) updateData.qtyOrdered = data.qty;
  if (data.salePrice !== undefined) updateData.unitPrice = data.salePrice ?? null;
  if (data.locationId !== undefined) updateData.locationId = data.locationId ?? null;

  await prisma.salesOrderRow.update({
    where: { id: req.params.rowId },
    data: updateData,
  });

  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include: includeDetail });
  if (so) {
    res.json(await respondSalesOrder(so));
  } else {
    res.status(204).send();
  }
});

router.delete('/:id/rows/:rowId', async (req, res) => {
  const row = await prisma.salesOrderRow.findUnique({ where: { id: req.params.rowId } });
  if (!row) return res.status(404).json({ error: 'Line not found' });
  if (Number(row.qtyFulfilled) > 0) {
    return res.status(422).json({ error: 'Cannot delete a line that has already been fulfilled.' });
  }
  await prisma.salesOrderRow.delete({ where: { id: req.params.rowId } });
  
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include: includeDetail });
  if (so) {
    res.json(await respondSalesOrder(so));
  } else {
    res.status(204).send();
  }
});

/**
 * Lots available to ship for one line (at the line or order default location).
 */
router.get('/:id/rows/:rowId/available-batches', async (req, res) => {
  const so = await prisma.salesOrder.findUnique({
    where: { id: req.params.id },
    include: { rows: true },
  });
  if (!so) return res.status(404).json({ error: 'Not found' });
  const row = (so.rows as any[]).find((r) => r.id === req.params.rowId);
  if (!row) return res.status(404).json({ error: 'Line not found' });
  if (!row.variantId) {
    return res.json({ trackLotsAndExpiry: false, locationId: row.locationId ?? so.locationId, batches: [] });
  }
  const v = await prisma.variant.findUnique({
    where: { id: row.variantId },
    select: { product: { select: { trackLotsAndExpiry: true } } },
  });
  const trackLotsAndExpiry = Boolean(v?.product?.trackLotsAndExpiry);
  const locationId = row.locationId ?? so.locationId;
  if (!locationId) {
    return res.status(422).json({ error: 'Set a ship-from location on the line or order to list lots.' });
  }
  const stocks = await prisma.batchStock.findMany({
    where: {
      locationId,
      batch: { variantId: row.variantId },
      onHand: { gt: 0 },
    },
    include: { batch: { select: { id: true, batchNumber: true, expiryDate: true } } },
    orderBy: { batch: { expiryDate: 'asc' } },
  });
  res.json({
    trackLotsAndExpiry,
    locationId,
    batches: stocks.map((s) => ({
      batchStockId: s.id,
      batchId: s.batchId,
      batchNumber: s.batch.batchNumber,
      expiryDate: s.batch.expiryDate,
      onHand: Number(s.onHand),
    })),
  });
});

/**
 * @openapi
 * /sales-orders/{id}/fulfill:
 *   post:
 *     summary: Fulfill sales order lines (decrement stock, record fulfillments)
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locationId: { type: string, format: uuid }
 *               rows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [rowId, qty]
 *                   properties:
 *                     rowId: { type: string, format: uuid }
 *                     qty: { type: number, minimum: 0, exclusiveMinimum: true }
 *                     isReturn: { type: boolean, default: false }
 *     responses:
 *       '200':
 *         description: Updated sales order after fulfillment
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Order not found
 *       '422':
 *         description: Business rule violation (e.g. cancelled, no location)
 */
router.post('/:id/fulfill', async (req, res) => {
  const body = z.object({
    locationId: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().min(1).optional()),
    carrier: z.string().max(160).nullish(),
    trackingNumber: z.string().max(160).nullish(),
    shipMethod: z.string().max(160).nullish(),
    rows: z.array(z.object({
      rowId: z.string().uuid(),
      qty: z.coerce.number().positive(),
      isReturn: z.boolean().default(false),
      locationId: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().uuid().optional()),
      batchId: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().uuid().optional()),
    })).optional(),
  }).parse(req.body);
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include: includeList });
  if (!so) return res.status(404).json({ error: 'Not found' });
  if (so.status === 'cancelled') return res.status(422).json({ error: 'Cannot fulfill cancelled SO' });
  if (String(so.status).toLowerCase() === 'draft') {
    return res.status(422).json({ error: 'Confirm the order (leave Draft status) before fulfilling.' });
  }

  const rowsArr = so.rows as any[];
  if (!rowsArr.length) {
    return res.status(422).json({ error: 'Add at least one line item before fulfilling.' });
  }

  const rowsToFulfill = (body.rows ?? rowsArr.map((r: any) => ({
    rowId: r.id,
    qty: Number(r.qtyOrdered) - Number(r.qtyFulfilled || 0),
    isReturn: false as boolean,
    locationId: undefined as string | undefined,
  }))) as { rowId: string; qty: number; isReturn: boolean; locationId?: string; batchId?: string }[];

  const variantIds = [...new Set(rowsArr.map((r: any) => r.variantId).filter(Boolean))] as string[];
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, sku: true, name: true, product: { select: { name: true, trackLotsAndExpiry: true } } },
      })
    : [];
  const variantLabel = new Map(
    variants.map((v) => [v.id, [v.product?.name, v.sku || v.name].filter(Boolean).join(' · ') || v.id]),
  );
  const trackLotsByVariant = new Map(variants.map((v) => [v.id, Boolean(v.product?.trackLotsAndExpiry)]));

  for (const item of rowsToFulfill) {
    if (item.qty <= 0) continue;
    const row = rowsArr.find((r: any) => r.id === item.rowId);
    if (!row) return res.status(422).json({ error: 'Invalid line item in fulfillment request.' });
    if (!row.variantId) {
      return res.status(422).json({
        error: 'Cannot fulfill lines without a product variant. Assign a product to each line or remove the line.',
      });
    }
    const remaining = Number(row.qtyOrdered) - Number(row.qtyFulfilled || 0);
    if (item.qty > remaining) {
      const lab = variantLabel.get(row.variantId) || row.description || row.variantId;
      return res.status(422).json({
        error: `Ship quantity exceeds remaining open quantity for ${lab} (remaining: ${remaining}).`,
      });
    }
    const lineLoc = item.locationId ?? body.locationId ?? row.locationId ?? so.locationId;
    if (!lineLoc) {
      const lab = variantLabel.get(row.variantId) || row.description || 'line';
      return res.status(422).json({
        error:
          `No ship-from location for ${lab}. Set a line-level or order default location, or pick one location for the whole shipment in the fulfill dialog.`,
      });
    }
    const mustLot = row.variantId && trackLotsByVariant.get(row.variantId);
    if (mustLot && !item.batchId) {
      const lab = variantLabel.get(row.variantId) || row.description || 'line';
      return res.status(422).json({
        error: `${lab} is lot/expiry tracked — select a lot with available quantity at the ship-from location.`,
      });
    }
  }

  if (!rowsToFulfill.some((i) => i.qty > 0)) {
    return res.status(422).json({ error: 'Nothing left to fulfill on this order.' });
  }

  const tracking = {
    carrier: body.carrier?.trim() || undefined,
    trackingNumber: body.trackingNumber?.trim() || undefined,
    shipMethod: body.shipMethod?.trim() || undefined,
  };

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const item of rowsToFulfill) {
        if (item.qty <= 0) continue;
        const row = rowsArr.find((r: any) => r.id === item.rowId);
        if (!row || !row.variantId) continue;
        const srcLocationId = item.locationId ?? body.locationId ?? row.locationId ?? so.locationId;
        if (!srcLocationId) continue;
        const mov = {
          referenceType: 'sales_order' as const,
          referenceId: so.id,
          note: `SO ${so.number}`,
        };
        try {
          if (item.batchId) {
            await adjustVariantStockWithBatch(
              tx,
              {
                variantId: row.variantId,
                locationId: srcLocationId,
                qtyToShip: item.qty,
                batchId: item.batchId,
              },
              mov,
            );
          } else {
            await adjustStock(tx, row.variantId, srcLocationId, -item.qty, 'so_fulfillment', mov);
          }
        } catch (e: any) {
          if (e?.statusCode === 422) {
            const lab = variantLabel.get(row.variantId) || row.description || row.variantId;
            throw Object.assign(new Error(`${e.message} (${lab})`), { statusCode: 422 });
          }
          throw e;
        }
        await tx.salesOrderRow.update({ where: { id: row.id }, data: { qtyFulfilled: { increment: item.qty } } });
        await tx.salesOrderFulfillment.create({
          data: {
            orderId: so.id,
            rowId: row.id,
            qty: item.qty,
            locationId: srcLocationId,
            isReturn: item.isReturn,
            carrier: tracking.carrier,
            trackingNumber: tracking.trackingNumber,
            shipMethod: tracking.shipMethod,
            batchId: item.batchId ?? undefined,
          },
        });
      }
    });
  } catch (e: any) {
    if (e?.statusCode === 422) {
      return res.status(422).json({ error: e.message });
    }
    throw e;
  }

  const allRows = await prisma.salesOrderRow.findMany({ where: { orderId: so.id } });
  const allFulfilled = allRows.every(
    (r: any) => Number(r.qtyOrdered) <= 0 || Number(r.qtyFulfilled) >= Number(r.qtyOrdered),
  );
  const anyFulfilled = allRows.some((r: any) => Number(r.qtyFulfilled) > 0);
  const newStatus = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partial' : so.status;
  const updated = await prisma.salesOrder.update({ where: { id: so.id }, data: { status: newStatus }, include: includeDetail });
  res.json(await respondSalesOrder(updated));
});

// GET /sales_orders/:id/returnable_items — fulfilled rows not yet fully returned
/**
 * @openapi
 * /sales-orders/{id}/returnable-items:
 *   get:
 *     summary: List SO rows that can still be returned (fulfilled minus already returned)
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Array of returnable line summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   soRowId: { type: string, format: uuid }
 *                   variantId: { type: string, format: uuid, nullable: true }
 *                   description: { type: string, nullable: true }
 *                   qtyFulfilled: { type: number }
 *                   qtyReturned: { type: number }
 *                   qtyReturnable: { type: number }
 *                   unitPrice: { type: number, nullable: true }
 *       '404':
 *         description: Not found
 */
router.get('/:id/returnable-items', async (req, res) => {
  const order = await prisma.salesOrder.findUnique({
    where: { id: req.params.id },
    include: {
      rows: { include: { fulfillments: true } },
      fulfillments: true,
    },
  });
  if (!order) return res.status(404).json({ error: 'Not found' });

  const returns = await prisma.salesReturn.findMany({
    where: { orderId: req.params.id },
    select: { id: true },
  });
  const returnIds = returns.map((r: any) => r.id);
  const returnedRows = returnIds.length
    ? await prisma.salesReturnRow.findMany({ where: { returnId: { in: returnIds } } })
    : [];
  const returnedByRow: Record<string, number> = {};
  for (const r of returnedRows) {
    if (r.soRowId) returnedByRow[r.soRowId] = (returnedByRow[r.soRowId] || 0) + Number(r.qty);
  }

  const items = (order.rows || [])
    .filter((r: any) => Number(r.qtyFulfilled) > 0)
    .map((r: any) => ({
      soRowId: r.id,
      variantId: r.variantId,
      description: r.description,
      qtyFulfilled: Number(r.qtyFulfilled),
      qtyReturned: returnedByRow[r.id] || 0,
      qtyReturnable: Number(r.qtyFulfilled) - (returnedByRow[r.id] || 0),
      unitPrice: r.unitPrice,
    }))
    .filter((r: any) => r.qtyReturnable > 0);

  res.json(items);
});

// SO Addresses sub-routes
router.use(soAddressesRouter);

export default router;
