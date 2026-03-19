import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/stats', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [lowStock, openPos, openMos, lateSos, recentMovements] = await Promise.all([
    prisma.inventoryLevel.count({ where: { reorderPoint: { not: null }, AND: [{ onHand: { gt: 0 } }] } }),
    prisma.purchaseOrder.count({ where: { status: { in: ['draft','confirmed','partial'] } } }),
    prisma.manufacturingOrder.count({ where: { status: { in: ['draft','planned','in_progress'] } } }),
    prisma.salesOrder.count({ where: { status: { in: ['draft','confirmed','partial'] }, requiredDate: { lt: today } } }),
    prisma.inventoryMovement.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
  ]);

  res.json({
    lowStockCount: lowStock,
    openPoCount: openPos,
    openMoCount: openMos,
    lateSoCount: lateSos,
    recentMovements: recentMovements.map(m => ({
      id: m.id, variantId: m.variantId, locationId: m.locationId,
      qty: Number(m.qty), movementType: m.movementType, note: m.note, createdAt: m.createdAt,
    })),
  });
});

export default router;
