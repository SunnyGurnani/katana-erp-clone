import type { PurchaseOrder, PurchaseOrderRow, Supplier } from '@prisma/client';

export interface BillMapperInput {
  purchaseOrder: PurchaseOrder & { rows: PurchaseOrderRow[]; supplier: Supplier | null };
  vendorExternalId?: string | null;
  lineItemExternalIds?: Record<string, string>;
  mode?: 'bill' | 'purchase_order';
}

function n(v: unknown, fallback = 0): number {
  const value = Number(v);
  return Number.isFinite(value) ? value : fallback;
}

function mapLines(rows: PurchaseOrderRow[], lineItemExternalIds: Record<string, string>) {
  return rows.map((row, index) => {
    const qty = n(row.qtyOrdered);
    const unitPrice = n(row.unitPrice);
    const amount = qty * unitPrice;
    const itemRefId = row.materialId
      ? lineItemExternalIds[row.materialId]
      : row.variantId
        ? lineItemExternalIds[row.variantId]
        : undefined;
    return {
      LineNum: index + 1,
      Amount: amount,
      Description: row.description ?? undefined,
      DetailType: 'ItemBasedExpenseLineDetail',
      ItemBasedExpenseLineDetail: {
        Qty: qty,
        UnitPrice: unitPrice,
        ItemRef: itemRefId ? { value: itemRefId } : undefined,
      },
    };
  });
}

export function mapPurchaseOrderToQboBillOrPo(input: BillMapperInput): Record<string, unknown> {
  const { purchaseOrder, vendorExternalId, lineItemExternalIds = {}, mode = 'bill' } = input;
  const payloadBase = {
    DocNumber: purchaseOrder.number,
    TxnDate: purchaseOrder.orderDate ?? undefined,
    CurrencyRef: purchaseOrder.currency ? { value: purchaseOrder.currency } : undefined,
    VendorRef: vendorExternalId
      ? { value: vendorExternalId }
      : (purchaseOrder.supplierId ? { value: purchaseOrder.supplierId, name: purchaseOrder.supplier?.name ?? undefined } : undefined),
    PrivateNote: purchaseOrder.notes ?? undefined,
    Line: mapLines(purchaseOrder.rows ?? [], lineItemExternalIds),
  };

  if (mode === 'purchase_order') {
    return {
      ...payloadBase,
      POStatus: 'Open',
    };
  }
  return payloadBase;
}
