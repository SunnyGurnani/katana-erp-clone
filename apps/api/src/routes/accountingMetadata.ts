import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getPagination, paginated } from '../middleware/paginate';

const router = Router();
router.use(authenticate);

// GET /sales_order_accounting_metadata — SO summary with financial info for accounting
router.get('/sales-orders', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { status, customerId } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const [orders, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      include: { customer: true, rows: true, fulfillments: true },
      skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  const items = orders.map(o => {
    const subtotal = (o.rows || []).reduce((sum, r) => sum + Number(r.qtyOrdered) * Number(r.unitPrice ?? 0), 0);
    const taxAmount = (o.rows || []).reduce((sum, r) => sum + Number(r.qtyOrdered) * Number(r.unitPrice ?? 0) * Number(r.taxRate ?? 0) / 100, 0);
    const fulfilledQty = (o.fulfillments || []).reduce((sum, f) => sum + Number(f.qty), 0);
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      currency: o.currency,
      orderDate: o.orderDate,
      customer: o.customer,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat((subtotal + taxAmount).toFixed(2)),
      fulfilledQty,
      createdAt: o.createdAt,
    };
  });

  res.json(paginated(items, total, page, pageSize));
});

// GET /purchase_order_accounting_metadata
router.get('/purchase-orders', async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req);
  const { status, supplierId } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, rows: true, costRows: true },
      skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const items = orders.map(o => {
    const subtotal = (o.rows || []).reduce((sum, r) => sum + Number(r.qtyOrdered) * Number(r.unitPrice ?? 0), 0);
    const taxAmount = (o.rows || []).reduce((sum, r) => sum + Number(r.qtyOrdered) * Number(r.unitPrice ?? 0) * Number(r.taxRate ?? 0) / 100, 0);
    const additionalCosts = (o.costRows || []).reduce((sum, c) => sum + Number(c.amount), 0);
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      currency: o.currency,
      orderDate: o.orderDate,
      supplier: o.supplier,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      additionalCosts: parseFloat(additionalCosts.toFixed(2)),
      total: parseFloat((subtotal + taxAmount + additionalCosts).toFixed(2)),
      createdAt: o.createdAt,
    };
  });

  res.json(paginated(items, total, page, pageSize));
});

export default router;
