const badgeMap: Record<string, string> = {
  draft: "badge-gray", confirmed: "badge-blue", partial: "badge-yellow",
  received: "badge-green", fulfilled: "badge-green", cancelled: "badge-red",
  in_progress: "badge-yellow", planned: "badge-purple", done: "badge-green",
  committed: "badge-green", available: "badge-green", sold: "badge-gray",
  active: "badge-green", inactive: "badge-red", completed: "badge-green",
  sent: "badge-blue", accepted: "badge-green", rejected: "badge-red",
  expired: "badge-red", released: "badge-blue", not_started: "badge-gray",
  overdue: "badge-red", pending: "badge-yellow",
};

function normalizeStatus(status?: string): string {
  if (!status) return "";
  return status
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function toDisplayLabel(status?: string): string {
  const normalized = normalizeStatus(status);
  if (!normalized) return "Unknown";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const cls = badgeMap[normalized] || "badge-gray";
  return <span className={cls}>{toDisplayLabel(status)}</span>;
}

/* Katana-style status cell configuration */
interface StatusConfig {
  cellClass: string;
  label: string;
  hasChevron?: boolean;
}

const statusCellMap: Record<string, StatusConfig> = {
  in_stock:       { cellClass: "status-instock", label: "In stock" },
  instock:        { cellClass: "status-instock", label: "In stock" },
  processed:      { cellClass: "status-processed", label: "Processed" },
  done:           { cellClass: "status-done", label: "Done", hasChevron: true },
  completed:      { cellClass: "status-completed", label: "Done", hasChevron: true },
  not_available:  { cellClass: "status-not-available", label: "Not available" },
  expected:       { cellClass: "status-expected", label: "Expected" },
  not_applicable: { cellClass: "status-not-applicable", label: "N/A" },
  not_started:    { cellClass: "status-not-started", label: "Not started", hasChevron: true },
  ready_packing:  { cellClass: "status-ready-packing", label: "Ready for packing" },
  packed:         { cellClass: "status-packed", label: "Packed" },
  not_shipped:    { cellClass: "status-not-shipped", label: "Not shipped" },
  not_invoiced:   { cellClass: "status-not-invoiced", label: "Not invoiced" },
  make:           { cellClass: "status-make", label: "Make..." },
  picked:         { cellClass: "status-picked", label: "Picked" },
  in_progress:    { cellClass: "status-in-progress", label: "In progress" },
  blocked:        { cellClass: "status-blocked", label: "Blocked" },
  paused:         { cellClass: "status-paused", label: "Paused" },
  partial:        { cellClass: "status-partial", label: "Partial" },
  draft:          { cellClass: "status-draft", label: "Draft" },
  sent:           { cellClass: "status-sent", label: "Sent" },
  received:       { cellClass: "status-received", label: "Received" },
  fulfilled:      { cellClass: "status-fulfilled", label: "Fulfilled" },
  cancelled:      { cellClass: "status-cancelled", label: "Cancelled" },
  released:       { cellClass: "status-released", label: "Released" },
  accepted:       { cellClass: "status-accepted", label: "Accepted" },
  rejected:       { cellClass: "status-rejected", label: "Rejected" },
  expired:        { cellClass: "status-expired", label: "Expired" },
  confirmed:      { cellClass: "status-confirmed", label: "Confirmed" },
};

/** Full-cell colored status for use in table columns — Katana style */
export function StatusCell({ status, label, className }: { status: string; label?: string; className?: string }) {
  const normalized = normalizeStatus(status);
  const config = statusCellMap[normalized] || {
    cellClass: "status-cell bg-gray-100 text-gray-500",
    label: toDisplayLabel(status),
  };
  const displayLabel = label || config.label;
  return (
    <div className={`${config.cellClass} ${className || ""}`}>
      {displayLabel}
      {config.hasChevron && <span className="ml-1 opacity-70">&rsaquo;</span>}
    </div>
  );
}
