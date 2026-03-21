import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

// ─── Forecast ────────────────────────────────────────────────────────────────

router.get('/forecast', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);

  // Current on-hand by variant+location
  const levels = await prisma.inventoryLevel.findMany({
    select: {
      variantId: true,
      locationId: true,
      onHand: true,
      variant: { select: { sku: true, product: { select: { name: true } } } },
      location: { select: { name: true } },
    },
  });

  // Expected: from open POs (not cancelled, not fully received)
  const openPORows = await prisma.purchaseOrderRow.findMany({
    where: {
      order: { status: { in: ['draft', 'confirmed', 'partial'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyReceived: true, order: { select: { locationId: true } } },
  });

  const expectedMap: Record<string, number> = {};
  for (const r of openPORows) {
    if (!r.variantId || !r.order.locationId) continue;
    const key = `${r.variantId}|${r.order.locationId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  }

  // Committed: from open SOs (not cancelled, not fully fulfilled)
  const openSORows = await prisma.salesOrderRow.findMany({
    where: {
      order: { status: { in: ['draft', 'confirmed', 'partial'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyFulfilled: true, order: { select: { locationId: true } } },
  });

  const committedMap: Record<string, number> = {};
  for (const r of openSORows) {
    if (!r.variantId || !r.order.locationId) continue;
    const key = `${r.variantId}|${r.order.locationId}`;
    committedMap[key] = (committedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyFulfilled));
  }

  const forecast = levels.map(level => {
    const key = `${level.variantId}|${level.locationId}`;
    const onHand = Number(level.onHand);
    const expected = expectedMap[key] || 0;
    const committed = committedMap[key] || 0;
    return {
      variantId: level.variantId,
      variantSku: level.variant.sku,
      productName: level.variant.product.name,
      locationId: level.locationId,
      locationName: level.location.name,
      onHand,
      expected,
      committed,
      projected: onHand + expected - committed,
    };
  });

  // Paginate
  const total = forecast.length;
  const paged = forecast.slice(skip, skip + take);
  res.json(paginated(paged, total, page, pageSize));
});

// ─── Replenishment ───────────────────────────────────────────────────────────

router.get('/replenishment', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);

  // Get all inventory levels with reorder points
  const levels = await prisma.inventoryLevel.findMany({
    where: { reorderPoint: { not: null } },
    select: {
      variantId: true,
      locationId: true,
      onHand: true,
      reorderPoint: true,
      reorderQty: true,
      variant: { select: { sku: true, product: { select: { name: true } } } },
    },
  });

  // Expected from open POs
  const openPORows = await prisma.purchaseOrderRow.findMany({
    where: {
      order: { status: { in: ['draft', 'confirmed', 'partial'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyReceived: true, order: { select: { locationId: true } } },
  });

  const expectedMap: Record<string, number> = {};
  for (const r of openPORows) {
    if (!r.variantId || !r.order.locationId) continue;
    const key = `${r.variantId}|${r.order.locationId}`;
    expectedMap[key] = (expectedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyReceived));
  }

  // Committed from open SOs
  const openSORows = await prisma.salesOrderRow.findMany({
    where: {
      order: { status: { in: ['draft', 'confirmed', 'partial'] } },
      variantId: { not: null },
    },
    select: { variantId: true, qtyOrdered: true, qtyFulfilled: true, order: { select: { locationId: true } } },
  });

  const committedMap: Record<string, number> = {};
  for (const r of openSORows) {
    if (!r.variantId || !r.order.locationId) continue;
    const key = `${r.variantId}|${r.order.locationId}`;
    committedMap[key] = (committedMap[key] || 0) + (Number(r.qtyOrdered) - Number(r.qtyFulfilled));
  }

  // Find preferred supplier per variant (most recent PO supplier)
  const variantIds = [...new Set(levels.map(l => l.variantId))];
  const supplierRows = variantIds.length
    ? await prisma.purchaseOrderRow.findMany({
        where: { variantId: { in: variantIds } },
        select: { variantId: true, order: { select: { supplierId: true, supplier: { select: { id: true, name: true } }, createdAt: true } } },
        orderBy: { order: { createdAt: 'desc' } },
      })
    : [];

  const preferredSupplierMap: Record<string, { id: string; name: string }> = {};
  for (const r of supplierRows) {
    if (r.variantId && !preferredSupplierMap[r.variantId] && r.order.supplier) {
      preferredSupplierMap[r.variantId] = { id: r.order.supplier.id, name: r.order.supplier.name };
    }
  }

  const suggestions = levels
    .map(level => {
      const key = `${level.variantId}|${level.locationId}`;
      const currentStock = Number(level.onHand);
      const expected = expectedMap[key] || 0;
      const committed = committedMap[key] || 0;
      const projected = currentStock + expected - committed;
      const reorderPoint = Number(level.reorderPoint);
      const reorderQty = Number(level.reorderQty || 0);

      if (projected >= reorderPoint) return null;

      const deficit = reorderPoint - projected;
      const suggestedQty = Math.max(deficit, reorderQty);

      return {
        variantId: level.variantId,
        variantSku: level.variant.sku,
        productName: level.variant.product.name,
        currentStock,
        reorderPoint,
        suggestedQty,
        preferredSupplier: preferredSupplierMap[level.variantId] || null,
      };
    })
    .filter(Boolean);

  const total = suggestions.length;
  const paged = suggestions.slice(skip, skip + take);
  res.json(paginated(paged, total, page, pageSize));
});

export default router;
