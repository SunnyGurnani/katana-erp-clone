const map: Record<string, string> = {
  draft: "badge-gray", confirmed: "badge-blue", partial: "badge-yellow",
  received: "badge-green", fulfilled: "badge-green", cancelled: "badge-red",
  in_progress: "badge-blue", planned: "badge-purple", done: "badge-green",
  committed: "badge-green", available: "badge-green", sold: "badge-gray",
  active: "badge-green", inactive: "badge-red",
};
export function StatusBadge({ status }: { status: string }) {
  const cls = map[status] || "badge-gray";
  return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}
