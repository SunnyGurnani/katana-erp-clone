import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /forecast — projected stock per variant/location
router.get('/forecast', async (req, res) => {
  // Current on-hand levels
  const levels = await prisma.inventoryLevel.findMany({
    include: {
      variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
      location: { select: { id: true, name: true } },
    },
  });

  // Expected from open POs (draft, partial, confirmed — not cancelled or received)
  const poRows = await prisma.purchaseOrderRow.findMany({
    where: {
      order: { status: { notIn: ['cancelled', 'received'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyReceived: true, order: { select: { locationId: true } } },
  });

  // Committed from open SOs (draft, partial — not fulfilled or cancelled)
  const soRows = await prisma.salesOrderRow.findMany({
    where: {
      order: { status: { notIn: ['cancelled', 'fulfilled'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyFulfilled: true, order: { select: { locationId: true } } },
  });

  // Build expected map: key = variantId|locationId
  const expectedMap: Record<string, number> = {};
  for (const r of poRows) {
    const locId = r.order.locationId;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  }

  // Build committed map: key = variantId|locationId
  const committedMap: Record<string, number> = {};
  for (const r of soRows) {
    const locId = r.order.locationId;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    committedMap[key] = (committedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyFulfilled));
  }

  const forecast = levels.map(l => {
    const key = `${l.variantId}|${l.locationId}`;
    const onHand = Number(l.onHand);
    const expected = expectedMap[key] || 0;
    const committed = committedMap[key] || 0;
    return {
      variantId: l.variantId,
      variantSku: l.variant.sku,
      productName: l.variant.product.name,
      locationId: l.locationId,
      locationName: l.location.name,
      onHand,
      expected,
      committed,
      projected: onHand + expected - committed,
    };
  });

  res.json(forecast);
});

// GET /replenishment — suggest purchases for low-stock variants
router.get('/replenishment', async (req, res) => {
  // Get all inventory levels with reorder points set
  const levels = await prisma.inventoryLevel.findMany({
    where: { reorderPoint: { not: null } },
    include: {
      variant: { select: { id: true, sku: true, purchasePrice: true, product: { select: { name: true } } } },
      location: { select: { id: true, name: true } },
    },
  });

  // Build expected/committed maps (same as forecast)
  const poRows = await prisma.purchaseOrderRow.findMany({
    where: {
      order: { status: { notIn: ['cancelled', 'received'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyReceived: true, order: { select: { locationId: true } } },
  });

  const soRows = await prisma.salesOrderRow.findMany({
    where: {
      order: { status: { notIn: ['cancelled', 'fulfilled'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyFulfilled: true, order: { select: { locationId: true } } },
  });

  const expectedMap: Record<string, number> = {};
  for (const r of poRows) {
    const locId = r.order.locationId;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  }

  const committedMap: Record<string, number> = {};
  for (const r of soRows) {
    const locId = r.order.locationId;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    committedMap[key] = (committedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyFulfilled));
  }

  // Find preferred supplier per variant (supplier with most PO rows for that variant)
  const variantIds = levels.map(l => l.variantId);
  const supplierRows = variantIds.length
    ? await prisma.purchaseOrderRow.findMany({
        where: { variantId: { in: variantIds } },
        select: { variantId: true, order: { select: { supplierId: true, supplier: { select: { id: true, name: true } } } } },
      })
    : [];

  const supplierCount: Record<string, Record<string, { count: number; name: string }>> = {};
  for (const r of supplierRows) {
    if (!r.variantId || !r.order.supplierId) continue;
    if (!supplierCount[r.variantId]) supplierCount[r.variantId] = {};
    if (!supplierCount[r.variantId][r.order.supplierId]) {
      supplierCount[r.variantId][r.order.supplierId] = { count: 0, name: r.order.supplier?.name || '' };
    }
    supplierCount[r.variantId][r.order.supplierId].count += 1;
  }

  function getPreferredSupplier(variantId: string) {
    const counts = supplierCount[variantId];
    if (!counts) return null;
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1].count - a[1].count);
    return { supplierId: entries[0][0], supplierName: entries[0][1].name };
  }

  const suggestions = levels
    .map(l => {
      const key = `${l.variantId}|${l.locationId}`;
      const onHand = Number(l.onHand);
      const expected = expectedMap[key] || 0;
      const committed = committedMap[key] || 0;
      const projected = onHand + expected - committed;
      const reorderPoint = Number(l.reorderPoint);
      const reorderQty = Number(l.reorderQty || 0);

      if (projected >= reorderPoint) return null;

      const deficit = reorderPoint - projected;
      const suggestedQty = Math.max(deficit, reorderQty);
      const preferred = getPreferredSupplier(l.variantId);

      return {
        variantId: l.variantId,
        variantSku: l.variant.sku,
        productName: l.variant.product.name,
        locationId: l.locationId,
        locationName: l.location.name,
        currentStock: onHand,
        reorderPoint,
        suggestedQty,
        preferredSupplier: preferred,
      };
    })
    .filter(Boolean);

  res.json(suggestions);
});

export default router;
