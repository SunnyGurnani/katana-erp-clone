/**
 * Format calendar dates from API without UTC/local off-by-one issues.
 * Use for `Date` @db.Date fields returned as `YYYY-MM-DD` and for ISO timestamps we only need the calendar day in local TZ.
 */
export function formatLocalDateYmd(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  if (iso instanceof Date) {
    if (isNaN(iso.getTime())) return "—";
    const y = iso.getFullYear();
    const m = String(iso.getMonth() + 1).padStart(2, "0");
    const d = String(iso.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(iso);
  const dateOnly = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  const t = new Date(s);
  if (isNaN(t.getTime())) return "—";
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLocalDateDisplay(iso: string | Date | null | undefined): string {
  if (iso == null) return "—";
  const ymd = formatLocalDateYmd(iso);
  if (ymd === "—") return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}
