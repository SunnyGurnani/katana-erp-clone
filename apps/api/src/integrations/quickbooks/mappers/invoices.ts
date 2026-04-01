import type { SalesOrder, SalesOrderRow, Customer } from '@prisma/client';

export interface InvoiceMapperInput {
  salesOrder: SalesOrder & { rows: SalesOrderRow[]; customer: Customer | null };
  customerExternalId?: string | null;
  lineItemExternalIds?: Record<string, string>;
}

function n(v: unknown, fallback = 0): number {
  const value = Number(v);
  return Number.isFinite(value) ? value : fallback;
}

export function mapSalesOrderToQboInvoice(input: InvoiceMapperInput): Record<string, unknown> {
  const { salesOrder, customerExternalId, lineItemExternalIds = {} } = input;
  const rows = salesOrder.rows ?? [];

  return {
    DocNumber: salesOrder.number,
    TxnDate: salesOrder.orderDate ?? undefined,
    DueDate: salesOrder.requiredDate ?? undefined,
    CurrencyRef: salesOrder.currency ? { value: salesOrder.currency } : undefined,
    CustomerRef: customerExternalId
      ? { value: customerExternalId }
      : (salesOrder.customerId ? { value: salesOrder.customerId, name: salesOrder.customer?.name ?? undefined } : undefined),
    PrivateNote: salesOrder.notes ?? undefined,
    Line: rows.map((row, index) => {
      const qty = n(row.qtyFulfilled || row.qtyOrdered, n(row.qtyOrdered));
      const unitPrice = n(row.unitPrice, 0);
      return {
        LineNum: index + 1,
        DetailType: 'SalesItemLineDetail',
        Amount: qty * unitPrice,
        Description: row.description ?? undefined,
        SalesItemLineDetail: {
          Qty: qty,
          UnitPrice: unitPrice,
          ItemRef: row.variantId && lineItemExternalIds[row.variantId]
            ? { value: lineItemExternalIds[row.variantId] }
            : undefined,
          TaxInclusiveAmt: qty * unitPrice,
        },
      };
    }),
  };
}
