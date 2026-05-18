import type { AccountingIntegration } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { qboRequest, upsertEntityMapping, getEntityMapping } from './api';
import { mapSalesOrderToQboInvoice } from './mappers/invoices';
import { mapSupplierToQboVendor } from './mappers/vendors';
import { mapCustomerToQboCustomer } from './mappers/customers';

async function ensureQboCustomer(integration: AccountingIntegration, customerId: string) {
  const existing = await getEntityMapping(integration.id, 'customer', customerId);
  if (existing) return existing.externalEntityId;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { addresses: true },
  });
  if (!customer) throw new Error('Customer not found');

  const payload = mapCustomerToQboCustomer(customer);
  const { data } = await qboRequest<{ Customer: { Id: string; SyncToken?: string } }>(
    integration,
    'POST',
    '/customer',
    payload,
  );
  const extId = data.Customer.Id;
  await upsertEntityMapping(integration.id, 'customer', customerId, extId, data.Customer.SyncToken);
  return extId;
}

async function ensureQboVendor(integration: AccountingIntegration, supplierId: string) {
  const existing = await getEntityMapping(integration.id, 'vendor', supplierId);
  if (existing) return existing.externalEntityId;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error('Supplier not found');

  const payload = mapSupplierToQboVendor(supplier);
  const { data } = await qboRequest<{ Vendor: { Id: string; SyncToken?: string } }>(
    integration,
    'POST',
    '/vendor',
    payload,
  );
  const extId = data.Vendor.Id;
  await upsertEntityMapping(integration.id, 'vendor', supplierId, extId, data.Vendor.SyncToken);
  return extId;
}

export async function syncQuickBooksContacts(integration: AccountingIntegration) {
  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true } }),
    prisma.supplier.findMany(),
  ]);
  const results: any[] = [];

  for (const c of customers) {
    try {
      const externalId = await ensureQboCustomer(integration, c.id);
      results.push({ id: c.id, type: 'customer', status: 'success', externalId });
    } catch (err: any) {
      results.push({ id: c.id, type: 'customer', status: 'error', error: err.message });
    }
  }
  for (const s of suppliers) {
    try {
      const externalId = await ensureQboVendor(integration, s.id);
      results.push({ id: s.id, type: 'vendor', status: 'success', externalId });
    } catch (err: any) {
      results.push({ id: s.id, type: 'vendor', status: 'error', error: err.message });
    }
  }

  return results;
}

export async function syncQuickBooksInvoice(
  integration: AccountingIntegration,
  salesOrderId: string,
) {
  const order = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: { customer: true, rows: true },
  });
  if (!order) throw new Error('Sales order not found');
  if (!order.customerId) throw new Error('Sales order has no customer');

  const customerExternalId = await ensureQboCustomer(integration, order.customerId);
  const payload = mapSalesOrderToQboInvoice({
    salesOrder: order,
    customerExternalId,
  });

  const existing = await getEntityMapping(integration.id, 'invoice', order.id);
  if (existing) {
    const { data } = await qboRequest<{ Invoice: { Id: string; SyncToken?: string } }>(
      integration,
      'POST',
      '/invoice',
      { ...payload, Id: existing.externalEntityId, SyncToken: existing.syncToken },
    );
    await upsertEntityMapping(
      integration.id,
      'invoice',
      order.id,
      data.Invoice.Id,
      data.Invoice.SyncToken,
    );
    return { externalId: data.Invoice.Id, updated: true };
  }

  const { data } = await qboRequest<{ Invoice: { Id: string; SyncToken?: string } }>(
    integration,
    'POST',
    '/invoice',
    payload,
  );
  await upsertEntityMapping(integration.id, 'invoice', order.id, data.Invoice.Id, data.Invoice.SyncToken);
  return { externalId: data.Invoice.Id, updated: false };
}

export async function syncQuickBooksBill(
  integration: AccountingIntegration,
  purchaseOrderId: string,
) {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { supplier: true, rows: true },
  });
  if (!order) throw new Error('Purchase order not found');
  if (!order.supplierId) throw new Error('Purchase order has no supplier');

  const vendorExternalId = await ensureQboVendor(integration, order.supplierId);
  let expenseAccountId = '7';
  try {
    const settings = integration.settings ? JSON.parse(integration.settings) : {};
    if (settings.accountMappings?.expenseAccount) {
      expenseAccountId = settings.accountMappings.expenseAccount;
    }
  } catch {
    /* use default */
  }

  const lines = (order.rows || []).map((row, index) => {
    const qty = Number(row.qtyOrdered);
    const unitPrice = Number(row.unitPrice ?? 0);
    return {
      LineNum: index + 1,
      DetailType: 'AccountBasedExpenseLineDetail',
      Amount: qty * unitPrice,
      Description: row.description ?? undefined,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: expenseAccountId },
      },
    };
  });

  const payload = {
    DocNumber: order.number,
    VendorRef: { value: vendorExternalId },
    Line: lines,
  };

  const { data } = await qboRequest<{ Bill: { Id: string; SyncToken?: string } }>(
    integration,
    'POST',
    '/bill',
    payload,
  );
  await upsertEntityMapping(integration.id, 'bill', order.id, data.Bill.Id, data.Bill.SyncToken);
  return { externalId: data.Bill.Id };
}
