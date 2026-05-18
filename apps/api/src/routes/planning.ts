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

function weekStartMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function weekIndexForDate(date: Date | null | undefined, anchor: Date, weeks: number): number | null {
  if (!date) return null;
  const idx = Math.floor((weekStartMonday(date).getTime() - anchor.getTime()) / (7 * 86400000));
  if (idx < 0 || idx >= weeks) return null;
  return idx;
}

function deltaKey(variantId: string, locId: string) {
  return `${variantId}|${locId}`;
}

// GET /weekly — projected stock per variant from open SO/PO/MO by week
router.get('/weekly', async (req, res) => {
  const weeks = Math.min(26, Math.max(4, Number(req.query.weeks) || 12));
  const locationId = req.query.locationId as string | undefined;
  const includeDemandForecast = req.query.includeDemandForecast === 'true';

  const defaultLoc =
    (await prisma.location.findFirst({ where: { isDefault: true } })) ??
    (await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } }));
  const locId = locationId || defaultLoc?.id;

  const anchor = weekStartMonday(new Date());
  const weekLabels: string[] = [];
  for (let w = 0; w < weeks; w++) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + w * 7);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    weekLabels.push(`W${weekNum}`);
  }

  const incoming: Record<string, number[]> = {};
  const outgoing: Record<string, number[]> = {};

  function addDelta(map: Record<string, number[]>, variantId: string, location: string | null | undefined, week: number, qty: number) {
    const lid = location || defaultLoc?.id;
    if (!lid || week < 0 || week >= weeks) return;
    const key = deltaKey(variantId, lid);
    if (!map[key]) map[key] = Array(weeks).fill(0);
    map[key][week] += qty;
  }

  const [poRows, soRows, mos] = await Promise.all([
    prisma.purchaseOrderRow.findMany({
      where: {
        variantId: { not: null },
        order: {
          status: { notIn: [...PO_STATUS_EXCLUDE_FROM_EXPECTED] },
          ...(locId ? { locationId: locId } : {}),
        },
      },
      select: {
        variantId: true,
        qtyOrdered: true,
        qtyReceived: true,
        order: { select: { locationId: true, expectedDate: true, orderDate: true, createdAt: true } },
      },
    }),
    prisma.salesOrderRow.findMany({
      where: {
        variantId: { not: null },
        order: { status: { notIn: ['cancelled', 'fulfilled'] } },
      },
      select: {
        variantId: true,
        locationId: true,
        qtyOrdered: true,
        qtyFulfilled: true,
        order: { select: { locationId: true, requiredDate: true, orderDate: true, createdAt: true } },
      },
    }),
    prisma.manufacturingOrder.findMany({
      where: { status: { notIn: ['done', 'cancelled'] } },
      select: {
        variantId: true,
        locationId: true,
        qtyPlanned: true,
        qtyProduced: true,
        plannedStart: true,
        plannedEnd: true,
        createdAt: true,
        recipeRows: { select: { variantId: true, materialId: true, qtyPlanned: true, qtyConsumed: true } },
      },
    }),
  ]);

  for (const r of poRows) {
    if (!r.variantId) continue;
    const remaining = Number(r.qtyOrdered) - Number(r.qtyReceived);
    if (remaining <= 0) continue;
    const date = r.order.expectedDate || r.order.orderDate || r.order.createdAt;
    const w = weekIndexForDate(date, anchor, weeks);
    if (w === null) continue;
    addDelta(incoming, r.variantId, r.order.locationId, w, remaining);
  }

  for (const r of soRows) {
    if (!r.variantId) continue;
    const remaining = Number(r.qtyOrdered) - Number(r.qtyFulfilled);
    if (remaining <= 0) continue;
    const date = r.order.requiredDate || r.order.orderDate || r.order.createdAt;
    const w = weekIndexForDate(date, anchor, weeks);
    if (w === null) continue;
    addDelta(outgoing, r.variantId, r.locationId || r.order.locationId, w, remaining);
  }

  if (includeDemandForecast) {
    const forecasts = await prisma.demandForecast.findMany({
      select: { variantId: true, locationId: true, qty: true, forecastAt: true },
    });
    for (const f of forecasts) {
      const w = weekIndexForDate(f.forecastAt, anchor, weeks);
      if (w === null) continue;
      addDelta(outgoing, f.variantId, f.locationId, w, Number(f.qty));
    }
  }

  for (const mo of mos) {
    const moLoc = mo.locationId || defaultLoc?.id;
    const moRemaining = Number(mo.qtyPlanned) - Number(mo.qtyProduced);
    if (moRemaining > 0 && mo.variantId) {
      const prodDate = mo.plannedEnd || mo.plannedStart || mo.createdAt;
      const w = weekIndexForDate(prodDate, anchor, weeks);
      if (w !== null) addDelta(incoming, mo.variantId, moLoc, w, moRemaining);
    }
    const recipeScale = Number(mo.qtyPlanned) > 0 ? moRemaining / Number(mo.qtyPlanned) : 0;
    if (recipeScale <= 0) continue;
    const consumeDate = mo.plannedStart || mo.plannedEnd || mo.createdAt;
    const w = weekIndexForDate(consumeDate, anchor, weeks);
    if (w === null) continue;
    for (const rr of mo.recipeRows) {
      if (!rr.variantId) continue;
      const need = (Number(rr.qtyPlanned) - Number(rr.qtyConsumed)) * recipeScale;
      if (need > 0) addDelta(outgoing, rr.variantId, moLoc, w, need);
    }
  }

  const levels = await prisma.inventoryLevel.findMany({
    where: locId ? { locationId: locId } : {},
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          product: { select: { name: true, unitOfMeasure: true } },
        },
      },
    },
    take: 200,
  });

  const levelKeys = new Set(levels.map((l) => deltaKey(l.variantId, l.locationId)));
  const extraKeys = [...new Set([...Object.keys(incoming), ...Object.keys(outgoing)])].filter((k) => !levelKeys.has(k));

  const extraVariantIds = [...new Set(extraKeys.map((k) => k.split('|')[0]))];
  const extraVariants = extraVariantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: extraVariantIds } },
        select: {
          id: true,
          sku: true,
          name: true,
          product: { select: { name: true, unitOfMeasure: true } },
        },
      })
    : [];
  const variantMap = new Map(extraVariants.map((v) => [v.id, v]));

  function buildRow(variantId: string, locationIdForRow: string, onHand: number, variant: any) {
    const key = deltaKey(variantId, locationIdForRow);
    const inc = incoming[key] || Array(weeks).fill(0);
    const out = outgoing[key] || Array(weeks).fill(0);
    const uom = variant?.product?.unitOfMeasure || 'pcs';
    const label = variant?.sku
      ? `[${variant.sku}] ${variant.product?.name || variant.name}${variant.name !== 'Default' ? ` / ${variant.name}` : ''}`
      : variant?.product?.name || variant?.name || variantId;
    const weekly: number[] = [];
    let stock = onHand;
    for (let w = 0; w < weeks; w++) {
      stock += inc[w] - out[w];
      weekly.push(Math.round(stock * 100) / 100);
    }
    return {
      variantId,
      locationId: locationIdForRow,
      label,
      unitOfMeasure: uom,
      existingStock: onHand,
      weeks: weekly,
    };
  }

  const rows = levels.map((l) => buildRow(l.variantId, l.locationId, Number(l.onHand), l.variant));

  for (const key of extraKeys) {
    const [variantId, locationIdForRow] = key.split('|');
    if (locId && locationIdForRow !== locId) continue;
    const v = variantMap.get(variantId);
    if (!v) continue;
    rows.push(buildRow(variantId, locationIdForRow, 0, v));
  }

  res.json({ weekLabels, rows });
});

export default router;
