import type { SearchableOption } from "@/components/ui/SearchableSelect";

/** Product variants (inventory / SO / transfers / adjustments). */
export function productVariantOptions(products: any[] | undefined): SearchableOption[] {
  return (products || []).flatMap((p: any) =>
    (p.variants || []).map((v: any) => {
      const sku = v.sku || "—";
      const variantName = v.name ? ` / ${v.name}` : "";
      return {
        value: v.id,
        label: `[${sku}] ${p.name}${variantName}`,
      };
    })
  );
}

/** Raw materials on PO lines (materialId, no variant). */
export function materialOptions(materials: any[] | undefined): SearchableOption[] {
  return (materials || []).map((m: any) => ({
    value: `material:${m.id}`,
    label: m.sku ? `${m.name} (${m.sku})` : m.name,
  }));
}

/** PO line picker: materials + product variants. */
export function purchaseLineOptions(materials: any[] | undefined, products: any[] | undefined): SearchableOption[] {
  return [...materialOptions(materials), ...productVariantOptions(products)];
}

export function parsePurchaseLineValue(val: string): { variantId?: string; materialId?: string } {
  if (!val) return {};
  if (val.startsWith("material:")) return { materialId: val.slice("material:".length) };
  return { variantId: val };
}

export function locationOptions(locations: any[] | undefined): SearchableOption[] {
  return (locations || []).map((l: any) => ({ value: l.id, label: l.name }));
}

export function customerOptions(customers: any[] | undefined): SearchableOption[] {
  return (customers || []).map((c: any) => ({ value: c.id, label: c.name }));
}

export function supplierOptions(suppliers: any[] | undefined): SearchableOption[] {
  return (suppliers || []).map((s: any) => ({ value: s.id, label: s.name }));
}

export function bomOptions(boms: any[] | undefined): SearchableOption[] {
  return (boms || []).map((b: any) => ({
    value: b.id,
    label: b.name || b.variant?.product?.name || b.id,
  }));
}

export function salesOrderOptions(orders: any[] | undefined): SearchableOption[] {
  return (orders || []).map((o: any) => ({
    value: o.id,
    label: String(o.soNumber || o.number || o.id),
  }));
}
