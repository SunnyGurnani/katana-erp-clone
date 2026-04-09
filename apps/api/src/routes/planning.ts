import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { PO_STATUS_EXCLUDE_FROM_EXPECTED } from '../lib/purchaseOrderStatus';

const router = Router();
router.use(authenticate);

// GET /forecast — projected stock per variant/location
router.get('/forecast', async (req, res) => {
  const defaultLoc =
    (await prisma.location.findFirst({ where: { isDefault: true } })) ??
    (await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } }));

  const levels = await prisma.inventoryLevel.findMany({
    include: {
      variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
      location: { select: { id: true, name: true } },
    },
  });

  const poRows = await prisma.purchaseOrderRow.findMany({
    where: {
      order: { status: { notIn: [...PO_STATUS_EXCLUDE_FROM_EXPECTED] } },
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
    const locId = r.order.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  }

  const committedMap: Record<string, number> = {};
  for (const r of soRows) {
    const locId = r.order.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    committedMap[key] = (committedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyFulfilled));
  }

  const forecast: any[] = levels.map((l: any) => {
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

  const levelKeys = new Set(levels.map((l) => `${l.variantId}|${l.locationId}`));
  const extraKeys = Object.keys(committedMap)
    .concat(Object.keys(expectedMap))
    .filter((k, i, a) => a.indexOf(k) === i)
    .filter((k) => !levelKeys.has(k));

  const variantIds = [...new Set(extraKeys.map((k) => k.split('|')[0]))];
  const locationIds = [...new Set(extraKeys.map((k) => k.split('|')[1]))];
  const [extraVariants, extraLocs] = await Promise.all([
    variantIds.length
      ? prisma.variant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, sku: true, product: { select: { name: true } } },
        })
      : [],
    locationIds.length
      ? prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const vMap = new Map(extraVariants.map((v) => [v.id, v]));
  const lMap = new Map(extraLocs.map((l) => [l.id, l]));

  for (const key of extraKeys) {
    const [variantId, locationId] = key.split('|');
    const v = vMap.get(variantId);
    const loc = lMap.get(locationId);
    if (!v || !loc) continue;
    const onHand = 0;
    const expected = expectedMap[key] || 0;
    const committed = committedMap[key] || 0;
    forecast.push({
      variantId,
      variantSku: v.sku,
      productName: v.product.name,
      locationId,
      locationName: loc.name,
      onHand,
      expected,
      committed,
      projected: onHand + expected - committed,
    });
  }

  res.json(forecast);
});

// GET /replenishment — suggest purchases for low-stock variants
router.get('/replenishment', async (req, res) => {
  const defaultLoc =
    (await prisma.location.findFirst({ where: { isDefault: true } })) ??
    (await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } }));

  const levels = await prisma.inventoryLevel.findMany({
    where: { reorderPoint: { not: null } },
    include: {
      variant: { select: { id: true, sku: true, purchasePrice: true, product: { select: { name: true } } } },
      location: { select: { id: true, name: true } },
    },
  });

  const poRows = await prisma.purchaseOrderRow.findMany({
    where: {
      order: { status: { notIn: [...PO_STATUS_EXCLUDE_FROM_EXPECTED] } },
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
    const locId = r.order.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  }

  const committedMap: Record<string, number> = {};
  for (const r of soRows) {
    const locId = r.order.locationId ?? defaultLoc?.id;
    if (!locId || !r.variantId) continue;
    const key = `${r.variantId}|${locId}`;
    committedMap[key] = (committedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyFulfilled));
  }

  // Find preferred supplier per variant (supplier with most PO rows for that variant)
  const variantIds = levels.map((l: any) => l.variantId);
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
    .map((l: any) => {
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
