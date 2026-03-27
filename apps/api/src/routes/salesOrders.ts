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
import { adjustStock } from '../lib/inventory';
import { z } from 'zod';
import soAddressesRouter from './soAddresses';

const router = Router();
router.use(authenticate);
router.use(requireOperatorForMutations);

async function nextSoNumber(): Promise<string> {
  const count = await prisma.salesOrder.count();
  return `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// SalesOrderRow has no Prisma relations other than order/fulfillments
const include = {
  customer: { select: { id: true, name: true } },
  rows: { include: { fulfillments: true } },
};

async function buildSoRowLookups(rows: any[]) {
  const variantIds = Array.from(new Set((rows || []).map((r: any) => r.variantId).filter(Boolean)));
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          product: { select: { id: true, name: true } },
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
    totalPrice: so.rows?.reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0) ?? 0,
    rows: so.rows?.map((r: any) => ({
      ...r,
      qty: r.qtyOrdered,
      salePrice: r.unitPrice,
      fulfilledQty: r.qtyFulfilled,
      variant: r.variant ?? (r.variantId && lookups ? lookups.variantById.get(r.variantId) || null : null),
    })),
  };
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
  if (req.query.status) where.status = req.query.status;
  const [items, total] = await Promise.all([
    prisma.salesOrder.findMany({ where, include, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.salesOrder.count({ where }),
  ]);
  const lookups = await buildSoRowLookups(items.flatMap((so: any) => so.rows || []));
  res.json(paginated(items.map((so: any) => normalizeSo(so, lookups)), total, page, pageSize));
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
    customerId: z.string().uuid().nullish(),
    currency: z.string().default('USD'),
    dueAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().min(1).nullish(),
    rows: z.array(z.object({
      variantId: z.string().uuid().nullish(),
      description: z.string().nullish(),
      qty: z.coerce.number().optional().default(1),
      qtyOrdered: z.coerce.number().optional(),
      salePrice: z.coerce.number().nullish(),
      unitPrice: z.coerce.number().nullish(),
    })).default([]),
  }).parse(req.body);
  const number = data.number || await nextSoNumber();
  const so = await prisma.salesOrder.create({
    data: {
      number, customerId: data.customerId ?? undefined, currency: data.currency,
      requiredDate: data.dueAt ? new Date(data.dueAt) : undefined,
      notes: data.notes ?? undefined, locationId: data.locationId ?? undefined,
      rows: {
        create: data.rows.map(r => ({
          variantId: r.variantId ?? undefined,
          description: r.description ?? undefined,
          qtyOrdered: r.qtyOrdered ?? r.qty,
          unitPrice: r.unitPrice ?? r.salePrice ?? undefined,
        })),
      },
    },
    include,
  });
  const lookups = await buildSoRowLookups(so.rows || []);
  res.status(201).json(normalizeSo(so, lookups));
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
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include });
  if (!so) return res.status(404).json({ error: 'Not found' });
  const lookups = await buildSoRowLookups(so.rows || []);
  res.json(normalizeSo(so, lookups));
});

async function updateSoById(req: any, res: any) {
  const data = z.object({
    customerId: z.string().uuid().nullish(), status: z.string().nullish(),
    currency: z.string().nullish(), dueAt: z.string().nullish(),
    notes: z.string().nullish(), locationId: z.string().min(1).nullish(),
  }).partial().parse(req.body);
  const soData: any = {};
  if (data.customerId !== undefined) soData.customerId = data.customerId;
  if (data.status) soData.status = data.status;
  if (data.currency) soData.currency = data.currency;
  if (data.notes !== undefined) soData.notes = data.notes;
  if (data.locationId !== undefined) soData.locationId = data.locationId;
  if (data.dueAt !== undefined) soData.requiredDate = data.dueAt ? new Date(data.dueAt) : null;
  const so = await prisma.salesOrder.update({ where: { id: req.params.id }, data: soData, include });
  const lookups = await buildSoRowLookups(so.rows || []);
  res.json(normalizeSo(so, lookups));
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
    variantId: z.string().uuid().nullish(), description: z.string().nullish(),
    qty: z.coerce.number().default(1), salePrice: z.coerce.number().nullish(),
  }).parse(req.body);
  const row = await prisma.salesOrderRow.create({
    data: { orderId: req.params.id, variantId: data.variantId ?? undefined, description: data.description ?? undefined, qtyOrdered: data.qty, unitPrice: data.salePrice ?? undefined },
  });
  res.status(201).json({ ...row, qty: row.qtyOrdered, salePrice: row.unitPrice });
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
    rows: z.array(z.object({ rowId: z.string().uuid(), qty: z.coerce.number().positive(), isReturn: z.boolean().default(false) })).optional(),
  }).parse(req.body);
  const so = await prisma.salesOrder.findUnique({ where: { id: req.params.id }, include });
  if (!so) return res.status(404).json({ error: 'Not found' });
  if (so.status === 'cancelled') return res.status(422).json({ error: 'Cannot fulfill cancelled SO' });
  const srcLocationId = body.locationId ?? so.locationId;
  if (!srcLocationId) return res.status(422).json({ error: 'Provide a locationId (or set a default location on the sales order).' });

  const rowsArr = so.rows as any[];
  if (!rowsArr.length) {
    return res.status(422).json({ error: 'Add at least one line item before fulfilling.' });
  }

  const rowsToFulfill = body.rows ?? rowsArr.map((r: any) => ({
    rowId: r.id, qty: Number(r.qtyOrdered) - Number(r.qtyFulfilled || 0), isReturn: false,
  }));

  for (const item of rowsToFulfill) {
    if (item.qty <= 0) continue;
    const row = rowsArr.find((r: any) => r.id === item.rowId);
    if (!row) return res.status(422).json({ error: 'Invalid line item in fulfillment request.' });
    if (!row.variantId) {
      return res.status(422).json({
        error: 'Cannot fulfill lines without a product variant. Assign a product to each line or remove the line.',
      });
    }
  }

  if (!rowsToFulfill.some((i) => i.qty > 0)) {
    return res.status(422).json({ error: 'Nothing left to fulfill on this order.' });
  }

  await prisma.$transaction(async (tx: any) => {
    for (const item of rowsToFulfill) {
      if (item.qty <= 0) continue;
      const row = (so.rows as any[]).find((r: any) => r.id === item.rowId);
      if (!row || !row.variantId) continue;
      await adjustStock(tx, row.variantId, srcLocationId, -item.qty, 'so_fulfillment', { referenceType: 'sales_order', referenceId: so.id, note: `SO ${so.number}` });
      await tx.salesOrderRow.update({ where: { id: row.id }, data: { qtyFulfilled: { increment: item.qty } } });
      // Create per-row fulfillment record
      await tx.salesOrderFulfillment.create({
        data: { orderId: so.id, rowId: row.id, qty: item.qty, locationId: srcLocationId, isReturn: item.isReturn },
      });
    }
  });

  const allRows = await prisma.salesOrderRow.findMany({ where: { orderId: so.id } });
  const allFulfilled = allRows.every((r: any) => Number(r.qtyFulfilled) >= Number(r.qtyOrdered));
  const anyFulfilled = allRows.some((r: any) => Number(r.qtyFulfilled) > 0);
  const newStatus = allFulfilled ? 'fulfilled' : anyFulfilled ? 'partial' : so.status;
  const updated = await prisma.salesOrder.update({ where: { id: so.id }, data: { status: newStatus }, include });
  const lookups = await buildSoRowLookups(updated.rows || []);
  res.json(normalizeSo(updated, lookups));
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
