/**
 * Purchase orders: listing, CRUD, line items, and goods receipt.
 * @openapi
 * tags:
 *   - name: PurchaseOrders
 *     description: Supplier purchase orders and receiving
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

async function nextPoNumber(): Promise<string> {
  const count = await prisma.purchaseOrder.count();
  return `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// PurchaseOrderRow has no Prisma relations to variant/material — just IDs
const include = {
  supplier: { select: { id: true, name: true } },
  rows: true,
  costRows: true,
};

async function buildPoRowLookups(rows: any[]) {
  const materialIds = Array.from(new Set((rows || []).map((r: any) => r.materialId).filter(Boolean)));
  const variantIds = Array.from(new Set((rows || []).map((r: any) => r.variantId).filter(Boolean)));

  const [materials, variants] = await Promise.all([
    materialIds.length
      ? prisma.material.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, name: true, sku: true },
        })
      : Promise.resolve([]),
    variantIds.length
      ? prisma.variant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    materialById: new Map(materials.map((m: any) => [m.id, m])),
    variantById: new Map(variants.map((v: any) => [v.id, v])),
  };
}

function normalizePo(po: any, lookups?: { materialById: Map<string, any>; variantById: Map<string, any> }) {
  return {
    ...po,
    poNumber: po.number,
    totalCost: po.rows?.reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0) ?? 0,
    expectedAt: po.expectedDate,
    rows: po.rows?.map((r: any) => ({
      ...r,
      qty: r.qtyOrdered,
      unitCost: r.unitPrice,
      material: r.material ?? (r.materialId && lookups ? lookups.materialById.get(r.materialId) || null : null),
      variant: r.variant ?? (r.variantId && lookups ? lookups.variantById.get(r.variantId) || null : null),
    })),
  };
}

/**
 * @openapi
 * /purchase-orders:
 *   get:
 *     summary: List purchase orders (paginated)
 *     tags: [PurchaseOrders]
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
 *         description: Paginated normalized POs (poNumber, rows with qty/unitCost)
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
    where.NOT = {
      OR: [
        { status: { equals: 'received', mode: 'insensitive' } },
        { status: { equals: 'cancelled', mode: 'insensitive' } },
      ],
    };
  } else if (req.query.status) {
    where.status = { equals: String(req.query.status).trim(), mode: 'insensitive' };
  }
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.purchaseOrder.count({ where }),
  ]);
  const lookups = await buildPoRowLookups(items.flatMap((po: any) => po.rows || []));
  res.json(paginated(items.map((po: any) => normalizePo(po, lookups)), total, page, pageSize));
});

/**
 * @openapi
 * /purchase-orders:
 *   post:
 *     summary: Create a purchase order with optional line rows
 *     tags: [PurchaseOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number: { type: string }
 *               supplierId: { type: string, format: uuid, nullable: true }
 *               currency: { type: string, default: USD }
 *               expectedAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *               rows:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variantId: { type: string, format: uuid, nullable: true }
 *                     materialId: { type: string, format: uuid, nullable: true }
 *                     description: { type: string, nullable: true }
 *                     qtyOrdered: { type: number }
 *                     qty: { type: number }
 *                     unitPrice: { type: number, nullable: true }
 *                     unitCost: { type: number, nullable: true }
 *     responses:
 *       '201':
 *         description: Created PO (normalized)
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/', async (req, res) => {
  const data = z.object({
    number: z.string().optional(),
    supplierId: z.string().uuid().nullish(),
    currency: z.string().default('USD'),
    expectedAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().min(1).nullish(),
    rows: z.array(z.object({
      variantId: z.string().uuid().nullish(),
      materialId: z.string().uuid().nullish(),
      description: z.string().nullish(),
      qtyOrdered: z.coerce.number().optional().default(1),
      qty: z.coerce.number().optional(),
      unitPrice: z.coerce.number().nullish(),
      unitCost: z.coerce.number().nullish(),
    })).default([]),
  }).parse(req.body);
  const number = data.number || await nextPoNumber();
  const rows = data.rows.map(r => ({
    variantId: r.variantId ?? undefined,
    materialId: r.materialId ?? undefined,
    description: r.description ?? undefined,
    qtyOrdered: r.qty ?? r.qtyOrdered ?? 1,
    unitPrice: r.unitCost ?? r.unitPrice ?? undefined,
  }));
  const po = await prisma.purchaseOrder.create({
    data: {
      number, supplierId: data.supplierId ?? undefined, currency: data.currency,
      expectedDate: data.expectedAt ? new Date(data.expectedAt) : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: { create: rows },
    },
    include,
  });
  const lookups = await buildPoRowLookups(po.rows || []);
  res.status(201).json(normalizePo(po, lookups));
});

/**
 * @openapi
 * /purchase-orders/{id}:
 *   get:
 *     summary: Get a purchase order by id
 *     tags: [PurchaseOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Normalized PO
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 */
router.get('/:id', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  const lookups = await buildPoRowLookups(po.rows || []);
  res.json(normalizePo(po, lookups));
});

async function updatePoById(req: any, res: any) {
  const data = z.object({
    supplierId: z.string().uuid().nullish(), status: z.string().nullish(),
    currency: z.string().nullish(), expectedAt: z.string().nullish(),
    notes: z.string().nullish(), locationId: z.string().min(1).nullish(),
  }).partial().parse(req.body);
  const poData: any = {};
  if (data.supplierId !== undefined) poData.supplierId = data.supplierId;
  if (data.status) poData.status = data.status;
  if (data.currency) poData.currency = data.currency;
  if (data.notes !== undefined) poData.notes = data.notes;
  if (data.locationId !== undefined) poData.locationId = data.locationId;
  if (data.expectedAt !== undefined) poData.expectedDate = data.expectedAt ? new Date(data.expectedAt) : null;
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: poData, include });
  const lookups = await buildPoRowLookups(po.rows || []);
  res.json(normalizePo(po, lookups));
}

/**
 * @openapi
 * /purchase-orders/{id}:
 *   put:
 *     summary: Replace/update purchase order header fields
 *     tags: [PurchaseOrders]
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
 *               supplierId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, nullable: true }
 *               currency: { type: string, nullable: true }
 *               expectedAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated PO
 *         content:
 *           application/json:
 *             schema: { type: object }
 *   patch:
 *     summary: Partially update purchase order header fields
 *     tags: [PurchaseOrders]
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
 *               supplierId: { type: string, format: uuid, nullable: true }
 *               status: { type: string, nullable: true }
 *               currency: { type: string, nullable: true }
 *               expectedAt: { type: string, nullable: true }
 *               notes: { type: string, nullable: true }
 *               locationId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       '200':
 *         description: Updated PO
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.put('/:id', updatePoById);
router.patch('/:id', updatePoById);

/**
 * @openapi
 * /purchase-orders/{id}/rows:
 *   post:
 *     summary: Add a line item to a purchase order
 *     tags: [PurchaseOrders]
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
 *               materialId: { type: string, format: uuid, nullable: true }
 *               description: { type: string, nullable: true }
 *               qty: { type: number, default: 1 }
 *               unitCost: { type: number, nullable: true }
 *     responses:
 *       '201':
 *         description: Created row
 *         content:
 *           application/json:
 *             schema: { type: object }
 */
router.post('/:id/rows', async (req, res) => {
  const data = z.object({
    variantId: z.string().uuid().nullish(), materialId: z.string().uuid().nullish(),
    description: z.string().nullish(), qty: z.coerce.number().default(1), unitCost: z.coerce.number().nullish(),
  }).parse(req.body);
  const row = await prisma.purchaseOrderRow.create({
    data: { orderId: req.params.id, variantId: data.variantId ?? undefined, materialId: data.materialId ?? undefined, description: data.description ?? undefined, qtyOrdered: data.qty, unitPrice: data.unitCost ?? undefined },
  });
  res.status(201).json({ ...row, qty: row.qtyOrdered, unitCost: row.unitPrice });
});

/**
 * @openapi
 * /purchase-orders/{id}/receive:
 *   post:
 *     summary: Receive goods against PO lines (increment stock, update qtyReceived)
 *     tags: [PurchaseOrders]
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
 *                   required: [rowId, receivedQty]
 *                   properties:
 *                     rowId: { type: string, format: uuid }
 *                     receivedQty: { type: number, minimum: 0, exclusiveMinimum: true }
 *     responses:
 *       '200':
 *         description: Updated PO after receipt
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       '404':
 *         description: Not found
 *       '422':
 *         description: Business rule violation
 */
router.post('/:id/receive', async (req, res) => {
  const body = z.object({
    locationId: z.string().min(1).optional(),
    rows: z.array(z.object({ rowId: z.string().uuid(), receivedQty: z.coerce.number().positive() })).optional(),
  }).parse(req.body);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (po.status === 'cancelled') return res.status(422).json({ error: 'Cannot receive cancelled PO' });
  const destLocationId = body.locationId ?? po.locationId;
  if (!destLocationId) return res.status(422).json({ error: 'Provide a locationId' });

  const rowsToReceive = body.rows ?? (po.rows as any[]).map((r: any) => ({ rowId: r.id, receivedQty: Number(r.qtyOrdered) - Number(r.qtyReceived || 0) }));

  await prisma.$transaction(async (tx: any) => {
    for (const recv of rowsToReceive) {
      if (recv.receivedQty <= 0) continue;
      const row = (po.rows as any[]).find((r: any) => r.id === recv.rowId);
      if (!row) continue;
      if (row.variantId) {
        await adjustStock(tx, row.variantId, destLocationId, recv.receivedQty, 'po_receipt', { referenceType: 'purchase_order', referenceId: po.id, note: `PO ${po.number}` });
      }
      await tx.purchaseOrderRow.update({ where: { id: row.id }, data: { qtyReceived: { increment: recv.receivedQty } } });
    }
  });

  const allRows = await prisma.purchaseOrderRow.findMany({ where: { orderId: po.id } });
  const allFulfilled = allRows.every((r: any) => Number(r.qtyReceived) >= Number(r.qtyOrdered));
  const anyFulfilled = allRows.some((r: any) => Number(r.qtyReceived) > 0);
  const newStatus = allFulfilled ? 'received' : anyFulfilled ? 'partial' : po.status;
  const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus }, include });
  const lookups = await buildPoRowLookups(updated.rows || []);
  res.json(normalizePo(updated, lookups));
});

export default router;
