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

  const [productCount, materialCount, supplierCount, customerCount, openPos, openMos, openSos, recentMovements] = await Promise.all([
    prisma.product.count(),
    prisma.material.count(),
    prisma.supplier.count(),
    prisma.customer.count(),
    prisma.purchaseOrder.count({ where: { status: { in: ['draft', 'sent', 'partial', 'confirmed'] } } }),
    prisma.manufacturingOrder.count({ where: { status: { in: ['draft', 'released', 'in_progress', 'planned'] } } }),
    prisma.salesOrder.count({ where: { status: { in: ['draft', 'confirmed', 'partial'] } } }),
    prisma.inventoryMovement.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
  ]);

  const lowStockCount = await prisma.inventoryLevel.count({ where: { reorderPoint: { not: null, gt: 0 } } }).catch(() => 0);

  // Aggregate revenue/spend — SalesOrder and PurchaseOrder don't have totalPrice/totalCost columns;
  // compute from rows instead
  const revenue30dRows = await prisma.salesOrderRow.aggregate({
    where: { order: { status: 'fulfilled', updatedAt: { gte: thirtyDaysAgo } } },
    _sum: { unitPrice: true },
  });
  const poSpend30dRows = await prisma.purchaseOrderRow.aggregate({
    where: { order: { status: 'received', updatedAt: { gte: thirtyDaysAgo } } },
    _sum: { unitPrice: true },
  });

  const revenue30d = Number(revenue30dRows._sum.unitPrice || 0);
  const poSpend30d = Number(poSpend30dRows._sum.unitPrice || 0);

  res.json({
    productCount, materialCount, supplierCount, customerCount,
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
