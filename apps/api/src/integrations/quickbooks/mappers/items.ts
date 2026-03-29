import type { Material, Product, Service, Variant } from '@prisma/client';

/** QuickBooks Item.Type values we emit (not a Prisma enum). */
type QboItemType = 'Service' | 'NonInventory' | 'Inventory';

type SourceKind = 'variant' | 'product' | 'material' | 'service';

export interface ItemMapperInput {
  sourceKind: SourceKind;
  variant?: Variant & { product?: Product };
  product?: Product;
  material?: Material;
  service?: Service;
  incomeAccountRef?: string;
  expenseAccountRef?: string;
  assetAccountRef?: string;
}

function amount(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapToQboItem(input: ItemMapperInput): Record<string, unknown> {
  const incomeAccountRef = input.incomeAccountRef ? { value: input.incomeAccountRef } : undefined;
  const expenseAccountRef = input.expenseAccountRef ? { value: input.expenseAccountRef } : undefined;
  const assetAccountRef = input.assetAccountRef ? { value: input.assetAccountRef } : undefined;

  if (input.sourceKind === 'service' && input.service) {
    return {
      Name: input.service.name,
      Sku: input.service.sku ?? undefined,
      Description: input.service.description ?? undefined,
      Type: 'Service' satisfies QboItemType,
      Active: input.service.isActive,
      UnitPrice: amount(input.service.price),
      IncomeAccountRef: incomeAccountRef,
    };
  }

  if (input.sourceKind === 'material' && input.material) {
    return {
      Name: input.material.name,
      Sku: input.material.sku ?? undefined,
      Description: input.material.description ?? undefined,
      Type: 'NonInventory' satisfies QboItemType,
      Active: input.material.isActive,
      UnitPrice: amount(input.material.purchasePrice),
      ExpenseAccountRef: expenseAccountRef,
    };
  }

  const base = input.sourceKind === 'variant' ? input.variant : input.product;
  const name = input.sourceKind === 'variant'
    ? `${input.variant?.product?.name ?? 'Product'} - ${input.variant?.name ?? 'Variant'}`
    : input.product?.name;
  const isInventory = Boolean(input.variant ?? input.product);

  return {
    Name: name ?? 'Item',
    Sku: base?.sku ?? undefined,
    Description: (base as Product | Variant | undefined)?.name ?? undefined,
    Type: (isInventory ? 'Inventory' : 'NonInventory') satisfies QboItemType,
    Active: base?.isActive ?? true,
    UnitPrice: amount((base as Variant | Product | undefined)?.salesPrice),
    PurchaseCost: amount((base as Variant | Product | undefined)?.purchasePrice),
    IncomeAccountRef: incomeAccountRef,
    ExpenseAccountRef: expenseAccountRef,
    AssetAccountRef: assetAccountRef,
    TrackQtyOnHand: isInventory,
  };
}
