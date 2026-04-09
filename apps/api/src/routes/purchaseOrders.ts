/**
 * Purchase orders: listing, CRUD, line items, and goods receipt.
 * @openapi
 * tags:
 *   - name: PurchaseOrders
 *     description: Supplier purchase orders and receiving
 */
import { randomBytes } from 'crypto';
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireOperatorForMutations } from '../middleware/roles';
import { getPagination, paginated } from '../middleware/paginate';
import { adjustStock } from '../lib/inventory';
import { sendMail, isMailConfigured } from '../lib/mail';
import { env } from '../env';
import { z } from 'zod';
import { normalizePoStatus, PO_STATUS_VALUES, type PoStatus } from '../lib/purchaseOrderStatus';

const router = Router();

const poStatusZ = z.enum(PO_STATUS_VALUES);
router.use(authenticate);
router.use(requireOperatorForMutations);

async function nextPoNumber(): Promise<string> {
  const count = await prisma.purchaseOrder.count();
  return `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// PurchaseOrderRow has no Prisma relations to variant/material — just IDs
const include = {
  supplier: { select: { id: true, name: true, email: true } },
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
            product: { select: { id: true, name: true, trackLotsAndExpiry: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    materialById: new Map(materials.map((m: any) => [m.id, m])),
    variantById: new Map(variants.map((v: any) => [v.id, v])),
  };
}

function vendorPortalLinkFromPo(po: { vendorPortalToken?: string | null }): string | null {
  const t = po.vendorPortalToken;
  if (!t) return null;
  const base = env.APP_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/vendor/po/${t}`;
}

function normalizePo(po: any, lookups?: { materialById: Map<string, any>; variantById: Map<string, any> }) {
  const { vendorPortalToken: _omit, ...poSafe } = po;
  const status: PoStatus = normalizePoStatus(po.status);
  return {
    ...poSafe,
    status,
    poNumber: po.number,
    vendorPortalLink: vendorPortalLinkFromPo(po),
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

/** PO goods receipt movements with lot/expiry for the detail UI (legacy rows use note + batch lookup). */
async function buildReceiptLinesForPo(poId: string) {
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      movementType: 'po_receipt',
      referenceType: 'purchase_order',
      referenceId: poId,
    },
    include: {
      batch: { select: { batchNumber: true, expiryDate: true } },
      location: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const out: any[] = [];
  for (const m of movements) {
    let lotNumber: string | null = m.batch?.batchNumber ?? null;
    let expiryDate: string | null =
      m.batch?.expiryDate != null ? new Date(m.batch.expiryDate).toISOString().slice(0, 10) : null;
    if (!lotNumber && m.note) {
      const match = String(m.note).match(/·\s*lot\s+(.+)$/);
      if (match) {
        lotNumber = match[1].trim();
        const b = await prisma.batch.findUnique({
          where: { variantId_batchNumber: { variantId: m.variantId, batchNumber: lotNumber } },
          select: { expiryDate: true },
        });
        if (b?.expiryDate) expiryDate = new Date(b.expiryDate).toISOString().slice(0, 10);
      }
    }
    out.push({
      id: m.id,
      purchaseOrderRowId: m.purchaseOrderRowId,
      variantId: m.variantId,
      qty: Number(m.qty),
      createdAt: m.createdAt,
      locationId: m.locationId,
      locationName: m.location?.name ?? null,
      lotNumber,
      expiryDate,
    });
  }
  return out;
}

async function normalizePoWithReceipts(po: any, lookups?: { materialById: Map<string, any>; variantById: Map<string, any> }) {
  const receiptLines = await buildReceiptLinesForPo(po.id);
  return { ...normalizePo(po, lookups), receiptLines };
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
    where.NOT = { status: { equals: 'done', mode: 'insensitive' } };
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
  res.status(201).json(await normalizePoWithReceipts(po, lookups));
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
  res.json(await normalizePoWithReceipts(po, lookups));
});

async function updatePoById(req: any, res: any) {
  const data = z.object({
    supplierId: z.string().uuid().nullish(),
    status: poStatusZ.nullish(),
    currency: z.string().nullish(),
    expectedAt: z.string().nullish(),
    notes: z.string().nullish(),
    locationId: z.string().min(1).nullish(),
  }).partial().parse(req.body);
  const poData: any = {};
  if (data.supplierId !== undefined) poData.supplierId = data.supplierId;
  if (data.status != null) poData.status = data.status;
  if (data.currency) poData.currency = data.currency;
  if (data.notes !== undefined) poData.notes = data.notes;
  if (data.locationId !== undefined) poData.locationId = data.locationId;
  if (data.expectedAt !== undefined) poData.expectedDate = data.expectedAt ? new Date(data.expectedAt) : null;
  const po = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: poData, include });
  const lookups = await buildPoRowLookups(po.rows || []);
  res.json(await normalizePoWithReceipts(po, lookups));
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

router.post('/:id/send-to-vendor', async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: { supplier: { select: { id: true, name: true, email: true } }, rows: true },
  });
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (String(po.status).toLowerCase() !== 'confirmed') {
    return res.status(422).json({ error: 'Set the PO to Confirmed before emailing the vendor.' });
  }
  const email = po.supplier?.email?.trim();
  if (!email) {
    return res.status(422).json({ error: 'The supplier must have an email address to receive the PO link.' });
  }
  const token = randomBytes(32).toString('hex');
  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      vendorPortalToken: token,
      vendorInviteSentAt: new Date(),
      vendorRespondedAt: null,
      vendorResponseComment: null,
    },
  });
  const link = vendorPortalLinkFromPo({ vendorPortalToken: token })!;
  const subject = `Purchase order ${po.number} — please confirm or reply`;
  const text = `Hello,\n\nPlease review purchase order ${po.number} and confirm it, or reply with changes / rejection using this secure link:\n\n${link}\n\nThank you.`;
  const html = `<p>Hello,</p><p>Please review purchase order <strong>${escapeHtml(po.number)}</strong>. You can <strong>confirm</strong> the order or <strong>reject / request modifications</strong> (with a message to us) using the link below.</p><p><a href="${escapeAttr(link)}">Open purchase order</a></p><p>Thank you.</p>`;
  try {
    await sendMail({ to: email, subject, text, html });
  } catch (e: any) {
    return res.status(502).json({ error: e?.message || 'Failed to send email.' });
  }
  const updated = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include });
  const lookups = await buildPoRowLookups(updated!.rows || []);
  res.json({
    ...(await normalizePoWithReceipts(updated!, lookups)),
    emailSent: isMailConfigured(),
    emailTo: email,
  });
});

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

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
    rows: z.array(z.object({
      rowId: z.string().uuid(),
      receivedQty: z.coerce.number().positive(),
      lots: z.array(
        z.object({
          batchNumber: z.string().min(1),
          expiryDate: z.coerce.date(),
          qty: z.coerce.number().positive(),
        }),
      ).optional(),
    })).optional(),
  }).parse(req.body);
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include });
  if (!po) return res.status(404).json({ error: 'Not found' });
  const st = normalizePoStatus(po.status);
  if (st === 'done') {
    return res.status(422).json({ error: 'This purchase order is closed; receiving is not allowed.' });
  }
  if (st !== 'vendor_confirmed' && st !== 'confirmed') {
    return res.status(422).json({
      error: 'Receive stock only when the purchase order is Confirmed (vendor confirmation is optional).',
    });
  }
  const destLocationId = body.locationId ?? po.locationId;
  if (!destLocationId) return res.status(422).json({ error: 'Provide a locationId' });

  const rowsToReceive = body.rows ?? (po.rows as any[]).map((r: any) => ({ rowId: r.id, receivedQty: Number(r.qtyOrdered) - Number(r.qtyReceived || 0) }));
  const rowById = new Map((po.rows as any[]).map((r: any) => [r.id, r]));
  const variantIds = [...new Set((po.rows as any[]).map((r: any) => r.variantId).filter(Boolean))] as string[];
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, sku: true, name: true, product: { select: { name: true, trackLotsAndExpiry: true } } },
      })
    : [];
  const variantById = new Map(variants.map((v: any) => [v.id, v]));

  for (const recv of rowsToReceive as any[]) {
    const row = rowById.get(recv.rowId);
    if (!row) {
      return res.status(422).json({ error: 'Invalid row in receive payload.' });
    }
    const remaining = Math.max(0, Number(row.qtyOrdered) - Number(row.qtyReceived || 0));
    if (Number(recv.receivedQty) > remaining) {
      return res.status(422).json({ error: `Received quantity exceeds remaining on a PO line (max ${remaining}).` });
    }
    if (!row.variantId) continue;
    const track = Boolean(variantById.get(row.variantId)?.product?.trackLotsAndExpiry);
    if (!track) continue;
    const lots = recv.lots || [];
    if (!lots.length) {
      const lab = variantById.get(row.variantId)?.sku || row.description || 'line';
      return res.status(422).json({ error: `${lab} is lot/expiry tracked — add at least one lot with expiry.` });
    }
    const sumLots = lots.reduce((s: number, l: any) => s + Number(l.qty || 0), 0);
    if (Math.abs(sumLots - Number(recv.receivedQty)) > 1e-9) {
      return res.status(422).json({ error: 'For lot-tracked items, sum of lot quantities must match received quantity.' });
    }
  }

  await prisma.$transaction(async (tx: any) => {
    for (const recv of rowsToReceive as any[]) {
      if (recv.receivedQty <= 0) continue;
      const row = (po.rows as any[]).find((r: any) => r.id === recv.rowId);
      if (!row) continue;
      if (row.variantId) {
        const vv = variantById.get(row.variantId);
        const track = Boolean(vv?.product?.trackLotsAndExpiry);
        if (track) {
          for (const lot of recv.lots || []) {
            const expiryDate = new Date(lot.expiryDate);
            let batch = await tx.batch.findFirst({
              where: {
                variantId: row.variantId,
                batchNumber: lot.batchNumber,
                expiryDate,
              },
            });
            if (!batch) {
              batch = await tx.batch.create({
                data: {
                  variantId: row.variantId,
                  batchNumber: lot.batchNumber,
                  expiryDate,
                  notes: `Received from PO ${po.number}`,
                },
              });
            }
            await tx.batchStock.upsert({
              where: { batchId_locationId: { batchId: batch.id, locationId: destLocationId } },
              create: { batchId: batch.id, locationId: destLocationId, onHand: Number(lot.qty), allocated: 0 },
              update: { onHand: { increment: Number(lot.qty) } },
            });
            await adjustStock(tx, row.variantId, destLocationId, Number(lot.qty), 'po_receipt', {
              referenceType: 'purchase_order',
              referenceId: po.id,
              note: `PO ${po.number} · lot ${lot.batchNumber}`,
              batchId: batch.id,
              purchaseOrderRowId: row.id,
            });
          }
        } else {
          await adjustStock(tx, row.variantId, destLocationId, recv.receivedQty, 'po_receipt', {
            referenceType: 'purchase_order',
            referenceId: po.id,
            note: `PO ${po.number}`,
            purchaseOrderRowId: row.id,
          });
        }
      }
      await tx.purchaseOrderRow.update({ where: { id: row.id }, data: { qtyReceived: { increment: recv.receivedQty } } });
    }
  });

  const allRows = await prisma.purchaseOrderRow.findMany({ where: { orderId: po.id } });
  const allFulfilled = allRows.every((r: any) => Number(r.qtyReceived) >= Number(r.qtyOrdered));
  const anyFulfilled = allRows.some((r: any) => Number(r.qtyReceived) > 0);
  const newStatus = allFulfilled ? 'done' : anyFulfilled ? 'vendor_confirmed' : po.status;
  const updated = await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus }, include });
  const lookups = await buildPoRowLookups(updated.rows || []);
  res.json(await normalizePoWithReceipts(updated, lookups));
});

export default router;
