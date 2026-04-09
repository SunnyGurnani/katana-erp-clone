/** Allowed purchase order workflow statuses (stored lowercase). */
export const PO_STATUS_VALUES = [
  'draft',
  'confirmed',
  'vendor_confirmed',
  'vendor_rejected',
  'done',
] as const;

export type PoStatus = (typeof PO_STATUS_VALUES)[number];

/** Closed — whole PO excluded from inbound “expected” / forecast (not line qty). */
export const PO_STATUS_EXCLUDE_FROM_EXPECTED: readonly string[] = ['done'];

const LEGACY_TO_CANONICAL: Record<string, PoStatus> = {
  cancelled: 'done',
  received: 'done',
  open: 'confirmed',
  sent: 'confirmed',
  partial: 'vendor_confirmed',
};

export function normalizePoStatus(raw: string | undefined | null): PoStatus {
  const s = String(raw ?? 'draft')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if ((PO_STATUS_VALUES as readonly string[]).includes(s)) return s as PoStatus;
  if (LEGACY_TO_CANONICAL[s]) return LEGACY_TO_CANONICAL[s];
  return 'draft';
}
