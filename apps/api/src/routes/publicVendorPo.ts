/**
 * Unauthenticated supplier portal for purchase order confirm / reject / request changes.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { normalizePoStatus } from '../lib/purchaseOrderStatus';

const include = {
  supplier: { select: { id: true, name: true } },
  rows: true,
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

const router = Router();

router.get('/:token', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (token.length < 16) return res.status(404).json({ error: 'Not found' });
  const po = await prisma.purchaseOrder.findFirst({
    where: { vendorPortalToken: token },
    include,
  });
  if (!po) return res.status(404).json({ error: 'Not found' });
  const lookups = await buildPoRowLookups(po.rows || []);
  const status = normalizePoStatus(po.status);
  const lines = (po.rows || []).map((r: any) => {
    const mat = r.materialId ? lookups.materialById.get(r.materialId) : null;
    const vari = r.variantId ? lookups.variantById.get(r.variantId) : null;
    const name = mat?.name || vari?.product?.name || r.description || '—';
    const sku = vari?.sku || mat?.sku || null;
    const variantSuffix = vari?.name && vari?.product ? ` / ${vari.name}` : '';
    return {
      description: `${name}${variantSuffix}`,
      sku,
      qty: Number(r.qtyOrdered),
      unitCost: r.unitPrice != null ? Number(r.unitPrice) : null,
    };
  });
  const canRespond = status === 'confirmed';
  let closedReason: string | null = null;
  if (status === 'vendor_confirmed') closedReason = 'You have already confirmed this purchase order.';
  else if (status === 'vendor_rejected') closedReason = 'This order was rejected or changes were requested.';
  else if (status === 'done') closedReason = 'This purchase order is complete.';
  else if (status === 'draft') closedReason = 'This purchase order is not yet ready for supplier response.';
  res.json({
    poNumber: po.number,
    status,
    currency: po.currency,
    expectedAt: po.expectedDate,
    supplierName: po.supplier?.name ?? null,
    lines,
    canRespond,
    closedReason,
    vendorResponseComment: po.vendorResponseComment,
    vendorRespondedAt: po.vendorRespondedAt,
  });
});

router.post('/:token/respond', async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (token.length < 16) return res.status(404).json({ error: 'Not found' });
  const body = z
    .object({
      action: z.enum(['confirm', 'reject', 'request_changes']),
      comment: z.string().optional(),
    })
    .parse(req.body);
  const comment = (body.comment || '').trim();
  if (body.action !== 'confirm' && comment.length === 0) {
    return res.status(422).json({ error: 'Please add a comment when rejecting or requesting modifications.' });
  }
  const po = await prisma.purchaseOrder.findFirst({
    where: { vendorPortalToken: token },
    include,
  });
  if (!po) return res.status(404).json({ error: 'Not found' });
  if (normalizePoStatus(po.status) !== 'confirmed') {
    return res.status(409).json({ error: 'This purchase order no longer accepts a response.' });
  }
  const now = new Date();
  if (body.action === 'confirm') {
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: 'vendor_confirmed',
        vendorRespondedAt: now,
        vendorResponseComment: null,
      },
    });
  } else {
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: 'vendor_rejected',
        vendorRespondedAt: now,
        vendorResponseComment: comment,
      },
    });
  }
  const updated = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include });
  const lookups = await buildPoRowLookups(updated!.rows || []);
  const lines = (updated!.rows || []).map((r: any) => {
    const mat = r.materialId ? lookups.materialById.get(r.materialId) : null;
    const vari = r.variantId ? lookups.variantById.get(r.variantId) : null;
    const name = mat?.name || vari?.product?.name || r.description || '—';
    const sku = vari?.sku || mat?.sku || null;
    const variantSuffix = vari?.name && vari?.product ? ` / ${vari.name}` : '';
    return { description: `${name}${variantSuffix}`, sku, qty: Number(r.qtyOrdered), unitCost: r.unitPrice != null ? Number(r.unitPrice) : null };
  });
  res.json({
    ok: true,
    status: updated!.status,
    poNumber: updated!.number,
    lines,
    vendorResponseComment: updated!.vendorResponseComment,
    vendorRespondedAt: updated!.vendorRespondedAt,
  });
});

export default router;
