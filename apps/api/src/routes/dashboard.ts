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

  // Aggregate revenue/spend — multiply unitPrice * qtyOrdered per row, then sum.
  // Prisma aggregate cannot multiply columns, so use raw SQL.
  const [revenue30dResult] = await prisma.$queryRaw<[{ total: number | null }]>`
    SELECT COALESCE(SUM(r.unit_price * r.qty_ordered), 0) AS total
    FROM sales_order_rows r
    JOIN sales_orders o ON o.id = r.order_id
    WHERE o.status = 'fulfilled' AND o.updated_at >= ${thirtyDaysAgo}
  `;
  const [poSpend30dResult] = await prisma.$queryRaw<[{ total: number | null }]>`
    SELECT COALESCE(SUM(r.unit_price * r.qty_ordered), 0) AS total
    FROM purchase_order_rows r
    JOIN purchase_orders o ON o.id = r.order_id
    WHERE o.status = 'received' AND o.updated_at >= ${thirtyDaysAgo}
  `;

  const revenue30d = Number(revenue30dResult.total || 0);
  const poSpend30d = Number(poSpend30dResult.total || 0);

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
