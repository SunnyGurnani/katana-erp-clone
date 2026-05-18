import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/stats', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [productCount, materialCount, locationCount, supplierCount, customerCount, openPos, openMos, openSos, factory, recentMovements] = await Promise.all([
    prisma.product.count(),
    prisma.material.count(),
    prisma.location.count(),
    prisma.supplier.count(),
    prisma.customer.count(),
    prisma.purchaseOrder.count({
      where: { NOT: { status: { equals: 'done', mode: 'insensitive' } } },
    }),
    prisma.manufacturingOrder.count({ where: { status: { in: ['draft', 'released', 'in_progress', 'planned'] } } }),
    prisma.salesOrder.count({ where: { status: { in: ['draft', 'confirmed', 'partial'] } } }),
    prisma.factory.findFirst(),
    prisma.inventoryMovement.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
  ]);

  // NOTE: raw SQL column names (on_hand, reorder_point) are tied to Prisma @map() directives in InventoryLevel
  const lowStockResult = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*)::int AS count FROM inventory_levels
    WHERE reorder_point IS NOT NULL AND reorder_point > 0 AND on_hand <= reorder_point
  `.catch(() => [{ count: 0 }]);
  const lowStockCount = Number(lowStockResult[0]?.count ?? 0);

  // Aggregate revenue/spend — SalesOrder and PurchaseOrder don't have totalPrice/totalCost columns;
  // compute from rows instead (qtyOrdered * unitPrice)
  const revenueRows = await prisma.salesOrderRow.findMany({
    where: { order: { status: 'fulfilled', updatedAt: { gte: thirtyDaysAgo } } },
    select: { qtyOrdered: true, unitPrice: true },
  });
  const revenue30d = revenueRows.reduce((sum: number, r: any) => sum + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);

  const poRows = await prisma.purchaseOrderRow.findMany({
    where: { order: { status: { equals: 'done', mode: 'insensitive' }, updatedAt: { gte: thirtyDaysAgo } } },
    select: { qtyOrdered: true, unitPrice: true },
  });
  const poSpend30d = poRows.reduce((sum: number, r: any) => sum + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);

  res.json({
    productCount, materialCount, locationCount, supplierCount, customerCount,
    factoryConfigured: Boolean(factory?.defaultLocationId && factory?.name),
    lowStockCount,
    openPurchaseOrders: openPos,
    openSalesOrders: openSos,
    openMfgOrders: openMos,
    revenue30d,
    poSpend30d,
    recentMovements: recentMovements.map((m: any) => ({
      id: m.id, qty: Number(m.qty), movementType: m.movementType, createdAt: m.createdAt,
      variantId: m.variantId, locationId: m.locationId,
    })),
  });
});

export default router;
