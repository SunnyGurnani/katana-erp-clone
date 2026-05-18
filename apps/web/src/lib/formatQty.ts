/** Format quantity with unit, e.g. `3 pcs`. */
export function formatQty(
  qty: number | string | null | undefined,
  uom?: string | null,
): string {
  const n = Number(qty);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : "0";
  const unit = (uom || "pcs").trim() || "pcs";
  return `${formatted} ${unit}`;
}
