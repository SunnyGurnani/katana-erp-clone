/* Badge map — small pill badges for use outside of tables */
const badgeMap: Record<string, string> = {
  fulfilled: "badge-green", done: "badge-green", completed: "badge-green",
  received: "badge-green", available: "badge-green", active: "badge-green",
  committed: "badge-green", accepted: "badge-green", in_stock: "badge-green",
  cancelled: "badge-red", overdue: "badge-red", inactive: "badge-red",
  rejected: "badge-red", expired: "badge-red", not_available: "badge-red",
  draft: "badge-gray", pending: "badge-yellow", in_progress: "badge-yellow",
  expected: "badge-yellow", sent: "badge-yellow",
  partial: "badge-blue", confirmed: "badge-blue",
  not_started: "badge-gray", sold: "badge-gray",
  planned: "badge-purple",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = badgeMap[status] || "badge-gray";
  return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}

/* Cell map — Katana-style full-cell background colors for table columns */
const cellMap: Record<string, { cls: string; label: string; chevron?: boolean }> = {
  in_stock:       { cls: "status-instock",       label: "In stock" },
  processed:      { cls: "status-processed",     label: "Processed" },
  done:           { cls: "status-done",          label: "Done", chevron: true },
  completed:      { cls: "status-completed",     label: "Completed" },
  not_available:  { cls: "status-not-available", label: "Not available" },
  expected:       { cls: "status-expected",      label: "Expected" },
  not_applicable: { cls: "status-not-applicable",label: "N/A" },
  not_started:    { cls: "status-not-started",   label: "Not started", chevron: true },
  ready_packing:  { cls: "status-ready-packing", label: "Ready for packing" },
  packed:         { cls: "status-packed",        label: "Packed" },
  not_shipped:    { cls: "status-not-shipped",   label: "Not shipped" },
  not_invoiced:   { cls: "status-not-invoiced",  label: "Not invoiced" },
  make:           { cls: "status-make",          label: "Make..." },
  picked:         { cls: "status-picked",        label: "Picked" },
  in_progress:    { cls: "status-in-progress",   label: "In progress" },
  blocked:        { cls: "status-blocked",       label: "Blocked" },
  paused:         { cls: "status-paused",        label: "Paused" },
  draft:          { cls: "status-draft",         label: "Draft" },
  confirmed:      { cls: "status-confirmed",     label: "Confirmed" },
  partial:        { cls: "status-partial",       label: "Partial" },
  cancelled:      { cls: "status-cancelled",     label: "Cancelled" },
  fulfilled:      { cls: "status-fulfilled",     label: "Fulfilled" },
  received:       { cls: "status-received",      label: "Received" },
  sent:           { cls: "status-sent",          label: "Sent" },
  accepted:       { cls: "status-accepted",      label: "Accepted" },
  rejected:       { cls: "status-rejected",      label: "Rejected" },
  expired:        { cls: "status-expired",       label: "Expired" },
  active:         { cls: "status-active",        label: "Active" },
  inactive:       { cls: "status-inactive",      label: "Inactive" },
  pending:        { cls: "status-pending",       label: "Pending" },
  planned:        { cls: "status-planned",       label: "Planned" },
};

/**
 * StatusCell — Katana-style full-cell colored background for table columns.
 * Fills the entire td area with a status color.
 */
export function StatusCell({ status, label, className }: { status: string; label?: string; className?: string }) {
  const config = cellMap[status] || { cls: "status-not-applicable", label: status.replace(/_/g, " ") };
  return (
    <div className={`${config.cls} ${className || ""}`}>
      {label || config.label}
      {config.chevron && <span className="ml-1">›</span>}
    </div>
  );
}
