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

  const soWhere = { ...dateWhere, status: { notIn: ['draft', 'cancelled'] } };

  const [orderCount, rows, orders] = await Promise.all([
    prisma.salesOrder.count({ where: soWhere }),
    prisma.salesOrderRow.findMany({
      where: { order: soWhere },
      select: { qtyOrdered: true, unitPrice: true },
    }),
    prisma.salesOrder.findMany({
      where: soWhere,
      select: { customerId: true, createdAt: true, rows: { select: { qtyOrdered: true, unitPrice: true } } },
    }),
  ]);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  // Top customers by revenue
  const customerRevenue: Record<string, number> = {};
  for (const o of orders) {
    if (!o.customerId) continue;
    const rev = (o.rows as any[]).reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
    customerRevenue[o.customerId] = (customerRevenue[o.customerId] || 0) + rev;
  }
  const topCustomerIds = Object.entries(customerRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const customers = topCustomerIds.length
    ? await prisma.customer.findMany({ where: { id: { in: topCustomerIds.map(c => c[0]) } }, select: { id: true, name: true } })
    : [];
  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
  const topCustomers = topCustomerIds.map(([id, revenue]) => ({ customerId: id, customerName: customerMap[id] || null, revenue }));

  // Revenue by month
  const revenueByMonth: Record<string, number> = {};
  for (const o of orders) {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
    const rev = (o.rows as any[]).reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
    revenueByMonth[key] = (revenueByMonth[key] || 0) + rev;
  }

  res.json({
    totalRevenue,
    orderCount,
    avgOrderValue,
    topCustomers,
    revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })).sort((a, b) => a.month.localeCompare(b.month)),
  });
});

router.get('/sales/by-product', async (req, res) => {
  const dateWhere = parseDateRange(req.query);
  const soWhere = { ...dateWhere, status: { notIn: ['draft', 'cancelled'] } };

  const rows = await prisma.salesOrderRow.findMany({
    where: { order: soWhere },
    select: { variantId: true, qtyOrdered: true, unitPrice: true },
  });

  const byVariant: Record<string, { qty: number; revenue: number }> = {};
  for (const r of rows) {
    const key = r.variantId || 'no-variant';
    if (!byVariant[key]) byVariant[key] = { qty: 0, revenue: 0 };
    byVariant[key].qty += Number(r.qtyOrdered);
    byVariant[key].revenue += Number(r.qtyOrdered) * Number(r.unitPrice || 0);
  }

  const variantIds = Object.keys(byVariant).filter(k => k !== 'no-variant');
  const variants = variantIds.length
    ? await prisma.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, name: true, product: { select: { name: true } } } })
    : [];
  const variantMap = Object.fromEntries(variants.map(v => [v.id, v]));

  const result = Object.entries(byVariant).map(([variantId, data]) => ({
    variantId: variantId === 'no-variant' ? null : variantId,
    variantSku: variantMap[variantId]?.sku || null,
    productName: variantMap[variantId]?.product?.name || null,
    qtySold: data.qty,
    revenue: data.revenue,
  })).sort((a, b) => b.revenue - a.revenue);

  res.json(result);
});

// ─── Manufacturing Insights ──────────────────────────────────────────────────

router.get('/manufacturing/summary', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const [totalMOs, completedMOs, mos, operationRows] = await Promise.all([
    prisma.manufacturingOrder.count({ where: dateWhere }),
    prisma.manufacturingOrder.count({ where: { ...dateWhere, status: 'done' } }),
    prisma.manufacturingOrder.findMany({
      where: dateWhere,
      select: { createdAt: true, status: true },
    }),
    prisma.mOOperationRow.findMany({
      where: { mo: dateWhere },
      select: { actualMinutes: true, operation: { select: { costPerHour: true } } },
    }),
  ]);

  // Avg production time from operations
  const completedOps = operationRows.filter(o => o.actualMinutes != null);
  const avgProductionTime = completedOps.length > 0
    ? completedOps.reduce((s, o) => s + (o.actualMinutes || 0), 0) / completedOps.length
    : 0;

  // Cost overview
  const laborCost = operationRows.reduce((s, o) => {
    if (!o.actualMinutes || !o.operation?.costPerHour) return s;
    return s + (o.actualMinutes / 60) * Number(o.operation.costPerHour);
  }, 0);

  // Material cost from recipe rows
  const recipeRows = await prisma.mORecipeRow.findMany({
    where: { mo: dateWhere },
    select: { qtyConsumed: true, variantId: true, materialId: true },
  });
  const variantIdsForCost = recipeRows.filter(r => r.variantId).map(r => r.variantId!);
  const materialIdsForCost = recipeRows.filter(r => r.materialId).map(r => r.materialId!);
  const [variantsForCost, materialsForCost] = await Promise.all([
    variantIdsForCost.length ? prisma.variant.findMany({ where: { id: { in: variantIdsForCost } }, select: { id: true, purchasePrice: true } }) : [],
    materialIdsForCost.length ? prisma.material.findMany({ where: { id: { in: materialIdsForCost } }, select: { id: true, purchasePrice: true } }) : [],
  ]);
  const varCostMap = Object.fromEntries(variantsForCost.map(v => [v.id, Number(v.purchasePrice || 0)]));
  const matCostMap = Object.fromEntries(materialsForCost.map(m => [m.id, Number(m.purchasePrice || 0)]));

  const materialCost = recipeRows.reduce((s, r) => {
    const unitCost = r.variantId ? (varCostMap[r.variantId] || 0) : r.materialId ? (matCostMap[r.materialId] || 0) : 0;
    return s + Number(r.qtyConsumed) * unitCost;
  }, 0);

  // Production by month
  const productionByMonth: Record<string, number> = {};
  for (const mo of mos) {
    const key = `${mo.createdAt.getFullYear()}-${String(mo.createdAt.getMonth() + 1).padStart(2, '0')}`;
    productionByMonth[key] = (productionByMonth[key] || 0) + 1;
  }

  res.json({
    totalMOs,
    completedMOs,
    avgProductionTime,
    costOverview: { materialCost, laborCost, totalCost: materialCost + laborCost },
    productionByMonth: Object.entries(productionByMonth).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
  });
});

router.get('/manufacturing/by-product', async (req, res) => {
  const dateWhere = parseDateRange(req.query);

  const mos = await prisma.manufacturingOrder.findMany({
    where: dateWhere,
    select: { productId: true, variantId: true, qtyPlanned: true, qtyProduced: true, status: true },
  });

  const byProduct: Record<string, { qtyPlanned: number; qtyProduced: number; count: number }> = {};
  for (const mo of mos) {
    const key = mo.productId;
    if (!byProduct[key]) byProduct[key] = { qtyPlanned: 0, qtyProduced: 0, count: 0 };
    byProduct[key].qtyPlanned += Number(mo.qtyPlanned);
    byProduct[key].qtyProduced += Number(mo.qtyProduced);
    byProduct[key].count += 1;
  }

  const products = await prisma.product.findMany({
    where: { id: { in: Object.keys(byProduct) } },
    select: { id: true, name: true },
  });
  const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));

  const result = Object.entries(byProduct).map(([productId, data]) => ({
    productId,
    productName: productMap[productId] || null,
    moCount: data.count,
    qtyPlanned: data.qtyPlanned,
    qtyProduced: data.qtyProduced,
  })).sort((a, b) => b.moCount - a.moCount);

  res.json(result);
});

// ─── Purchasing Insights ─────────────────────────────────────────────────────

router.get('/purchasing/summary', async (req, res) => {
  const dateWhere = parseDateRange(req.query);
  const poWhere = { ...dateWhere, status: { notIn: ['draft', 'cancelled'] } };

  const [poCount, rows, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where: poWhere }),
    prisma.purchaseOrderRow.findMany({
      where: { order: poWhere },
      select: { qtyOrdered: true, unitPrice: true },
    }),
    prisma.purchaseOrder.findMany({
      where: poWhere,
      select: { supplierId: true, createdAt: true, rows: { select: { qtyOrdered: true, unitPrice: true } } },
    }),
  ]);

  const totalPOSpend = rows.reduce((s, r) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
  const avgPOValue = poCount > 0 ? totalPOSpend / poCount : 0;

  // Top suppliers
  const supplierSpend: Record<string, number> = {};
  for (const o of orders) {
    if (!o.supplierId) continue;
    const spend = (o.rows as any[]).reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
    supplierSpend[o.supplierId] = (supplierSpend[o.supplierId] || 0) + spend;
  }
  const topSupplierIds = Object.entries(supplierSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const suppliers = topSupplierIds.length
    ? await prisma.supplier.findMany({ where: { id: { in: topSupplierIds.map(s => s[0]) } }, select: { id: true, name: true } })
    : [];
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
  const topSuppliers = topSupplierIds.map(([id, spend]) => ({ supplierId: id, supplierName: supplierMap[id] || null, spend }));

  // Spend by month
  const spendByMonth: Record<string, number> = {};
  for (const o of orders) {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`;
    const spend = (o.rows as any[]).reduce((s: number, r: any) => s + Number(r.qtyOrdered) * Number(r.unitPrice || 0), 0);
    spendByMonth[key] = (spendByMonth[key] || 0) + spend;
  }

  res.json({
    totalPOSpend,
    poCount,
    avgPOValue,
    topSuppliers,
    spendByMonth: Object.entries(spendByMonth).map(([month, spend]) => ({ month, spend })).sort((a, b) => a.month.localeCompare(b.month)),
  });
});

// ─── Inventory Insights ──────────────────────────────────────────────────────

router.get('/inventory/valuation', async (_req, res) => {
  const levels = await prisma.inventoryLevel.findMany({
    where: { onHand: { gt: 0 } },
    select: {
      variantId: true,
      locationId: true,
      onHand: true,
      variant: { select: { purchasePrice: true, sku: true, name: true, product: { select: { name: true } } } },
      location: { select: { name: true } },
    },
  });

  let totalValue = 0;
  const byLocation: Record<string, { locationName: string; value: number; items: any[] }> = {};

  for (const level of levels) {
    const unitCost = Number(level.variant.purchasePrice || 0);
    const value = Number(level.onHand) * unitCost;
    totalValue += value;

    if (!byLocation[level.locationId]) {
      byLocation[level.locationId] = { locationName: level.location.name, value: 0, items: [] };
    }
    byLocation[level.locationId].value += value;
    byLocation[level.locationId].items.push({
      variantId: level.variantId,
      variantSku: level.variant.sku,
      productName: level.variant.product.name,
      onHand: Number(level.onHand),
      unitCost,
      value,
    });
  }

  res.json({
    totalValue,
    byLocation: Object.entries(byLocation).map(([locationId, data]) => ({
      locationId,
      locationName: data.locationName,
      value: data.value,
      items: data.items.sort((a: any, b: any) => b.value - a.value),
    })).sort((a, b) => b.value - a.value),
  });
});

export default router;
