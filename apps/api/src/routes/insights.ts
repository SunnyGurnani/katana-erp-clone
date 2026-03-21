import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function parseDateRange(query: any) {
  const { from, to } = dateRangeSchema.parse(query);
  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  return where;
}

// ─── Sales Insights ──────────────────────────────────────────────────────────

router.get('/sales/summary', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const [orders, rows, topCustomers] = await Promise.all([
    prisma.salesOrder.findMany({ where: dateWhere, select: { id: true, customerId: true, createdAt: true } }),
    prisma.salesOrderRow.findMany({
      where: { order: dateWhere },
      select: { qtyOrdered: true, unitPrice: true, order: { select: { createdAt: true } } },
    }),
    prisma.salesOrder.groupBy({
      by: ['customerId'],
      where: { ...dateWhere, customerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
  const orderCount = orders.length;
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  // Revenue by month
  const revenueByMonth: Record<string, number> = {};
  for (const r of rows) {
    const month = r.order.createdAt.toISOString().slice(0, 7);
    revenueByMonth[month] = (revenueByMonth[month] || 0) + Number(r.qtyOrdered) * Number(r.unitPrice || 0);
  }

  // Resolve top customer names
  const customerIds = topCustomers.map(c => c.customerId).filter(Boolean) as string[];
  const customers = customerIds.length
    ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
    : [];
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));

  res.json({
    totalRevenue,
    orderCount,
    avgOrderValue,
    topCustomers: topCustomers.map(c => ({
      customerId: c.customerId,
      customerName: customerMap[c.customerId!] || null,
      orderCount: c._count.id,
    })),
    revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })),
  });
});

router.get('/sales/by-product', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const rows = await prisma.salesOrderRow.findMany({
    where: { order: dateWhere, variantId: { not: null } },
    select: { variantId: true, qtyOrdered: true, unitPrice: true },
  });

  const byProduct: Record<string, { qty: number; revenue: number }> = {};
  for (const r of rows) {
    const key = r.variantId!;
    if (!byProduct[key]) byProduct[key] = { qty: 0, revenue: 0 };
    byProduct[key].qty += Number(r.qtyOrdered);
    byProduct[key].revenue += Number(r.qtyOrdered) * Number(r.unitPrice || 0);
  }

  const variantIds = Object.keys(byProduct);
  const variants = variantIds.length
    ? await prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, sku: true, name: true, product: { select: { name: true } } },
      })
    : [];
  const variantMap = Object.fromEntries(variants.map(v => [v.id, v]));

  res.json(
    variantIds.map(id => ({
      variantId: id,
      variantSku: variantMap[id]?.sku || null,
      variantName: variantMap[id]?.name || null,
      productName: variantMap[id]?.product?.name || null,
      totalQty: byProduct[id].qty,
      totalRevenue: byProduct[id].revenue,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue),
  );
});

// ─── Manufacturing Insights ──────────────────────────────────────────────────

router.get('/manufacturing/summary', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const [totalMOs, completedMOs, mos, operationRows] = await Promise.all([
    prisma.manufacturingOrder.count({ where: dateWhere }),
    prisma.manufacturingOrder.count({ where: { ...dateWhere, status: 'done' } }),
    prisma.manufacturingOrder.findMany({
      where: dateWhere,
      select: { id: true, status: true, plannedStart: true, plannedEnd: true, createdAt: true },
    }),
    prisma.mOOperationRow.findMany({
      where: { mo: dateWhere },
      select: { actualMinutes: true, operation: { select: { costPerHour: true } } },
    }),
  ]);

  // Avg production time (planned days between start and end)
  const completedWithDates = mos.filter(m => m.plannedStart && m.plannedEnd);
  const avgProductionTime = completedWithDates.length > 0
    ? completedWithDates.reduce((s, m) => s + (m.plannedEnd!.getTime() - m.plannedStart!.getTime()), 0) / completedWithDates.length / (1000 * 60 * 60 * 24)
    : 0;

  // Cost overview from operation rows
  let laborCost = 0;
  for (const row of operationRows) {
    if (row.actualMinutes && row.operation?.costPerHour) {
      laborCost += (row.actualMinutes / 60) * Number(row.operation.costPerHour);
    }
  }

  // Material cost from recipe rows
  const recipeRows = await prisma.mORecipeRow.findMany({
    where: { mo: dateWhere },
    select: { qtyConsumed: true, variantId: true, materialId: true },
  });
  let materialCost = 0;
  const materialIds = recipeRows.filter(r => r.materialId).map(r => r.materialId!);
  const variantIds = recipeRows.filter(r => r.variantId).map(r => r.variantId!);
  const [materials, variants] = await Promise.all([
    materialIds.length ? prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, purchasePrice: true } }) : [],
    variantIds.length ? prisma.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, purchasePrice: true } }) : [],
  ]);
  const matPriceMap = Object.fromEntries(materials.map(m => [m.id, Number(m.purchasePrice || 0)]));
  const varPriceMap = Object.fromEntries(variants.map(v => [v.id, Number(v.purchasePrice || 0)]));
  for (const r of recipeRows) {
    const price = r.materialId ? (matPriceMap[r.materialId] || 0) : r.variantId ? (varPriceMap[r.variantId] || 0) : 0;
    materialCost += Number(r.qtyConsumed) * price;
  }

  // Production by month
  const productionByMonth: Record<string, number> = {};
  for (const m of mos) {
    const month = m.createdAt.toISOString().slice(0, 7);
    productionByMonth[month] = (productionByMonth[month] || 0) + 1;
  }

  res.json({
    totalMOs,
    completedMOs,
    avgProductionTime,
    costOverview: { materialCost, laborCost, totalCost: materialCost + laborCost },
    productionByMonth: Object.entries(productionByMonth).map(([month, count]) => ({ month, count })),
  });
});

router.get('/manufacturing/by-product', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const mos = await prisma.manufacturingOrder.findMany({
    where: dateWhere,
    select: { productId: true, variantId: true, qtyPlanned: true, qtyProduced: true, status: true },
  });

  const byProduct: Record<string, { qtyPlanned: number; qtyProduced: number; count: number }> = {};
  for (const m of mos) {
    const key = m.productId;
    if (!byProduct[key]) byProduct[key] = { qtyPlanned: 0, qtyProduced: 0, count: 0 };
    byProduct[key].qtyPlanned += Number(m.qtyPlanned);
    byProduct[key].qtyProduced += Number(m.qtyProduced);
    byProduct[key].count += 1;
  }

  const productIds = Object.keys(byProduct);
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true } })
    : [];
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  res.json(
    productIds.map(id => ({
      productId: id,
      productName: productMap[id]?.name || null,
      productSku: productMap[id]?.sku || null,
      moCount: byProduct[id].count,
      totalQtyPlanned: byProduct[id].qtyPlanned,
      totalQtyProduced: byProduct[id].qtyProduced,
    })).sort((a, b) => b.moCount - a.moCount),
  );
});

// ─── Purchasing Insights ─────────────────────────────────────────────────────

router.get('/purchasing/summary', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const [pos, rows, topSuppliers] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: dateWhere, select: { id: true, supplierId: true, createdAt: true } }),
    prisma.purchaseOrderRow.findMany({
      where: { order: dateWhere },
      select: { qtyOrdered: true, unitPrice: true, order: { select: { createdAt: true } } },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: { ...dateWhere, supplierId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  const totalPOSpend = rows.reduce((s, r) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
  const poCount = pos.length;
  const avgPOValue = poCount > 0 ? totalPOSpend / poCount : 0;

  const spendByMonth: Record<string, number> = {};
  for (const r of rows) {
    const month = r.order.createdAt.toISOString().slice(0, 7);
    spendByMonth[month] = (spendByMonth[month] || 0) + Number(r.qtyOrdered) * Number(r.unitPrice || 0);
  }

  const supplierIds = topSuppliers.map(s => s.supplierId).filter(Boolean) as string[];
  const suppliers = supplierIds.length
    ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } })
    : [];
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

  res.json({
    totalPOSpend,
    poCount,
    avgPOValue,
    topSuppliers: topSuppliers.map(s => ({
      supplierId: s.supplierId,
      supplierName: supplierMap[s.supplierId!] || null,
      poCount: s._count.id,
    })),
    spendByMonth: Object.entries(spendByMonth).map(([month, spend]) => ({ month, spend })),
  });
});

// ─── Inventory Insights ──────────────────────────────────────────────────────

router.get('/inventory/valuation', async (req, res) => {
  const levels = await prisma.inventoryLevel.findMany({
    where: { onHand: { gt: 0 } },
    select: {
      variantId: true,
      locationId: true,
      onHand: true,
      variant: { select: { purchasePrice: true, name: true, sku: true } },
      location: { select: { name: true } },
    },
  });

  let totalValue = 0;
  const byLocation: Record<string, { locationName: string; value: number; items: number }> = {};
  const items = levels.map(l => {
    const value = Number(l.onHand) * Number(l.variant.purchasePrice || 0);
    totalValue += value;
    if (!byLocation[l.locationId]) byLocation[l.locationId] = { locationName: l.location.name, value: 0, items: 0 };
    byLocation[l.locationId].value += value;
    byLocation[l.locationId].items += 1;
    return {
      variantId: l.variantId,
      variantSku: l.variant.sku,
      variantName: l.variant.name,
      locationId: l.locationId,
      locationName: l.location.name,
      onHand: Number(l.onHand),
      purchasePrice: Number(l.variant.purchasePrice || 0),
      value,
    };
  });

  res.json({
    totalValue,
    byLocation: Object.entries(byLocation).map(([locationId, data]) => ({ locationId, ...data })),
    items,
  });
});

export default router;
