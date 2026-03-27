import type { Supplier, SupplierAddress } from '@prisma/client';

function buildAddr(address?: SupplierAddress | null, fallback?: string | null) {
  if (!address && !fallback) return undefined;
  return {
    Line1: address?.line1 ?? fallback ?? undefined,
    Line2: address?.line2 ?? undefined,
    City: address?.city ?? undefined,
    CountrySubDivisionCode: address?.state ?? undefined,
    PostalCode: address?.zip ?? undefined,
    Country: address?.country ?? undefined,
  };
}

export function mapSupplierToQboVendor(
  supplier: Supplier & { addresses?: SupplierAddress[] },
): Record<string, unknown> {
  const billing = supplier.addresses?.find(a => a.type === 'billing' && a.isDefault)
    ?? supplier.addresses?.find(a => a.type === 'billing')
    ?? supplier.addresses?.find(a => a.isDefault)
    ?? supplier.addresses?.[0];

  return {
    DisplayName: supplier.name,
    CompanyName: supplier.name,
    PrimaryEmailAddr: supplier.email ? { Address: supplier.email } : undefined,
    PrimaryPhone: supplier.phone ? { FreeFormNumber: supplier.phone } : undefined,
    BillAddr: buildAddr(billing, supplier.address),
    PrintOnCheckName: supplier.name,
    Active: supplier.isActive,
    CurrencyRef: supplier.currency ? { value: supplier.currency } : undefined,
    Notes: supplier.notes ?? undefined,
    TermRef: supplier.paymentTerms ? { name: supplier.paymentTerms } : undefined,
  };
}
