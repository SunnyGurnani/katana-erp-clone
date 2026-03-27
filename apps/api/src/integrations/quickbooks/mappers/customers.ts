import type { Customer, CustomerAddress } from '@prisma/client';

function buildAddr(address?: CustomerAddress | null, fallback?: string | null) {
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

export function mapCustomerToQboCustomer(
  customer: Customer & { addresses?: CustomerAddress[] },
): Record<string, unknown> {
  const billing = customer.addresses?.find(a => a.type === 'billing' && a.isDefault)
    ?? customer.addresses?.find(a => a.type === 'billing')
    ?? customer.addresses?.find(a => a.isDefault)
    ?? customer.addresses?.[0];
  const shipping = customer.addresses?.find(a => a.type === 'shipping' && a.isDefault)
    ?? customer.addresses?.find(a => a.type === 'shipping')
    ?? billing;

  return {
    DisplayName: customer.name,
    CompanyName: customer.name,
    GivenName: customer.name,
    PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
    PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
    BillAddr: buildAddr(billing, customer.address),
    ShipAddr: buildAddr(shipping, customer.address),
    Notes: customer.notes ?? undefined,
    Active: customer.isActive,
    CurrencyRef: customer.currency ? { value: customer.currency } : undefined,
  };
}
