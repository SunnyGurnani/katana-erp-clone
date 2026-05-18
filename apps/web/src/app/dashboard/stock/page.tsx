"use client";
import { useState, useMemo, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, ArrowUpDown, HelpCircle } from "lucide-react";
import { formatLocalDateYmd } from "@/lib/formatDate";
import { formatQty } from "@/lib/formatQty";
import clsx from "clsx";

type InvLevelRow = {
  locationId: string;
  location: { id: string; name: string } | null;
  onHand: number;
  allocated: number;
  committed: number;
  expected: number;
  committedSalesOrder?: number;
  committedManufacturingOrder?: number;
  committedTransferOrder?: number;
  available: number;
  reorderPoint?: number | null;
};

type InvVariantRow = {
  variantId: string;
  variant: any;
  levels: InvLevelRow[];
  totalOnHand: number;
  totalAllocated: number;
  totalCommitted: number;
  totalExpected: number;
  totalCommittedSalesOrder?: number;
  totalCommittedManufacturingOrder?: number;
  totalCommittedTransferOrder?: number;
  totalAvailable: number;
};

type DemandDetails = {
  variantId: string;
  locationId: string | null;
  salesOrderAllocations: Array<{
    salesOrderId: string;
    salesOrderNumber: string;
    status: string;
    customerName: string | null;
    locationName: string | null;
    allocatedQty: number;
  }>;
  salesOrders: Array<{
    salesOrderId: string;
    salesOrderNumber: string;
    status: string;
    customerName: string | null;
    locationName: string | null;
    demandQty: number;
  }>;
  manufacturingOrders: Array<{
    manufacturingOrderId: string;
    manufacturingOrderNumber: string;
    status: string;
    locationName: string | null;
    demandQty: number;
  }>;
  transferOrders: Array<{
    transferOrderId: string;
    transferOrderNumber: string;
    status: string;
    fromLocationName: string | null;
    toLocationName: string | null;
    demandQty: number;
  }>;
  purchaseOrders: Array<{
    purchaseOrderId: string;
    purchaseOrderNumber: string;
    status: string;
    supplierName: string | null;
    locationName: string | null;
    expectedQty: number;
  }>;
  totals: {
    allocated: number;
    salesOrders: number;
    manufacturingOrders: number;
    transferOrders: number;
    committed: number;
    expected: number;
  };
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const levelAllocated = (lv: InvLevelRow): number => num(lv.allocated);
const levelCommitted = (lv: InvLevelRow): number => num(lv.committed);
const levelExpected = (lv: InvLevelRow): number => num(lv.expected);

function buildExpandedLevels(
  row: InvVariantRow,
  allLocations: { id: string; name: string }[],
  showEmptyWarehouses: boolean,
  locationFilter: string,
): InvLevelRow[] {
  const levels = row.levels || [];
  const byLoc = new Map(levels.map((l) => [l.locationId, l]));

  if (!showEmptyWarehouses) {
    if (locationFilter) return levels.filter((l) => l.locationId === locationFilter);
    return [...levels].sort((a, b) => (a.location?.name || "").localeCompare(b.location?.name || ""));
  }

  const locs = locationFilter
    ? allLocations.filter((l) => l.id === locationFilter)
    : [...allLocations].sort((a, b) => a.name.localeCompare(b.name));

  return locs.map((loc) => {
    const existing = byLoc.get(loc.id);
    if (existing) return existing;
    return {
      locationId: loc.id,
      location: { id: loc.id, name: loc.name },
      onHand: 0,
      allocated: 0,
      committed: 0,
      expected: 0,
      available: 0,
      reorderPoint: null,
    };
  });
}

const COL_HELP = {
  onHand: "Physical quantity on site (on hand).",
  allocated: "Reserved stock across picks/allocations (SO, MO, TO) that is not yet completed.",
  committed: "Open demand from Sales Orders + Manufacturing Orders + Transfer Orders.",
  expected: "Incoming quantity from open Purchase Orders (not yet received).",
  calculated: "Calculated stock: on hand + expected − committed.",
  avail: "Available to promise: on hand − committed − allocated.",
} as const;

function HelpHint({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 group relative">
      <HelpCircle size={14} className="text-gray-400 shrink-0" aria-hidden />
      <span className="sr-only">{text}</span>
      <span
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-56 rounded border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-normal leading-snug text-gray-600 shadow-md group-hover:block"
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}

type ItemFilter = "all" | "products" | "materials";

function rowUom(row: InvVariantRow): string {
  return row.variant?.product?.unitOfMeasure || row.variant?.material?.unitOfMeasure || "pcs";
}

function matchesItemFilter(row: InvVariantRow, filter: ItemFilter): boolean {
  if (filter === "all") return true;
  if (filter === "products") return Boolean(row.variant?.product);
  return Boolean(row.variant?.material);
}

export default function InventoryPage() {
  const [tab, setTab] = useState<"levels" | "movements">("levels");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [showEmptyWarehouses, setShowEmptyWarehouses] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailVariant, setDetailVariant] = useState<InvVariantRow | null>(null);
  const [detailMetric, setDetailMetric] = useState<"allocated" | "committed" | "expected">("committed");

  const { data: locations } = useQuery({
    queryKey: ["locations", "stock-filter"],
    queryFn: () => api.get("/locations", { params: { page: 1, pageSize: 250 } }).then((r) => r.data.data || []),
    enabled: tab === "levels",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-levels", 250, locationFilter || "all"],
    queryFn: () =>
      api
        .get("/inventory/levels", {
          params: {
            page: 1,
            pageSize: 250,
            ...(locationFilter ? { locationId: locationFilter } : {}),
          },
        })
        .then((r) => r.data.data as InvVariantRow[]),
    enabled: tab === "levels",
  });

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => api.get("/inventory-movements").then((r) => r.data.data || r.data),
    enabled: tab === "movements",
  });

  const { data: demandDetails, isLoading: demandLoading } = useQuery({
    queryKey: ["inventory-demand-details", detailVariant?.variantId, locationFilter || "all"],
    enabled: Boolean(detailOpen && detailVariant?.variantId),
    queryFn: () =>
      api
        .get(`/inventory/levels/${detailVariant?.variantId}/demand-details`, {
          params: locationFilter ? { locationId: locationFilter } : {},
        })
        .then((r) => r.data as DemandDetails),
  });

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSort = (key: string) => {
    if (sortCol === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(key);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    const list = [...(data || [])].filter((row) => matchesItemFilter(row, itemFilter));
    if (!sortCol) return list;
    return list.sort((a, b) => {
      let av: any;
      let bv: any;
      if (sortCol === "sku") {
        av = a.variant?.sku ?? "";
        bv = b.variant?.sku ?? "";
      } else if (sortCol === "item") {
        av = a.variant?.product?.name ?? a.variant?.material?.name ?? "";
        bv = b.variant?.product?.name ?? b.variant?.material?.name ?? "";
      } else {
        av = (a as any)[sortCol];
        bv = (b as any)[sortCol];
      }
      if (typeof av === "number" && typeof bv === "number") {
        const cmp = av - bv;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortCol, sortDir, itemFilter]);

  const locationOptions = useMemo(
    () => (locations || []).map((l: any) => ({ id: l.id, name: l.name })),
    [locations],
  );

  const movCols: Column[] = [
    { key: "createdAt", header: "Date", sortable: true, render: (r: any) => formatLocalDateYmd(r.createdAt) },
    { key: "variant", header: "Item", render: (r: any) => r.variant?.product?.name || r.variant?.material?.name || r.variant?.sku || "—" },
    { key: "movementType", header: "Type", render: (r: any) => <span className="badge">{r.movementType || r.type || "—"}</span> },
    { key: "qty", header: "Qty", render: (r: any) => <span className={Number(r.qty) < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{r.qty > 0 ? "+" : ""}{r.qty}</span> },
    { key: "location", header: "Location", render: (r: any) => r.location?.name || "—" },
    { key: "reference", header: "Reference", render: (r: any) => r.reference || "—" },
  ];

  const invColCount = 12;

  const SortIcon = ({ colKey }: { colKey: string }) =>
    sortCol === colKey ? (
      sortDir === "asc" ? (
        <ChevronUp size={10} />
      ) : (
        <ChevronDown size={10} />
      )
    ) : (
      <ArrowUpDown size={10} className="opacity-30" />
    );

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stock</h1>
          <p className="text-xs text-gray-500 mt-0.5 max-w-3xl">
            <strong>On hand</strong> is physical stock. <strong>Allocated</strong> is stock picked/reserved (SO, MO, TO).{" "}
            <strong>Committed</strong> is open demand on sales/manufacturing/transfer orders.{" "}
            <strong>Expected</strong> is incoming on open purchase orders. <strong>Avail</strong> = on hand − committed − allocated.
          </p>
        </div>
        {tab === "levels" && (
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 min-w-[200px]">
              <span className="text-xs font-medium text-gray-600">Location</span>
              <select
                className="input text-sm py-1.5"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="Filter by location"
              >
                <option value="">All locations</option>
                {locationOptions.map((l: { id: string; name: string }) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-1.5">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={showEmptyWarehouses}
                onChange={(e) => setShowEmptyWarehouses(e.target.checked)}
              />
              <span>Show warehouses with empty inventory</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap items-center">
          {tab === "levels" && (
            <div className="flex gap-1 mr-2 border-r border-gray-200 pr-2">
              {(["all", "products", "materials"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-xs font-medium capitalize",
                    itemFilter === f ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100",
                  )}
                  onClick={() => setItemFilter(f)}
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          )}
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === "levels" ? "bg-navy-800 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => setTab("levels")}
          >
            Inventory Levels
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === "movements" ? "bg-navy-800 text-white" : "text-gray-500 hover:bg-gray-100"}`}
            onClick={() => setTab("movements")}
          >
            Movements
          </button>
        </div>
        <ExportToolbar
          resource="inventory"
          filters={tab === "levels" && locationFilter ? { locationId: locationFilter } : undefined}
        />
      </div>

      {tab === "levels" ? (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
            {sortedRows.length} variants · Click a row to expand location detail
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10" aria-label="Expand" />
                  <th className="w-10 text-center">#</th>
                  <th className="cursor-pointer select-none hover:text-gray-700" onClick={() => handleSort("sku")}>
                    <span className="inline-flex items-center gap-1">
                      SKU
                      <SortIcon colKey="sku" />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none hover:text-gray-700 min-w-[140px]" onClick={() => handleSort("item")}>
                    <span className="inline-flex items-center gap-1">
                      Item
                      <SortIcon colKey="item" />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none hover:text-gray-700 text-right whitespace-nowrap" onClick={() => handleSort("totalOnHand")}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span className="inline-flex items-center gap-0.5">
                        On hand
                        <HelpHint text={COL_HELP.onHand} />
                      </span>
                      <SortIcon colKey="totalOnHand" />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none hover:text-gray-700 text-right whitespace-nowrap" onClick={() => handleSort("totalAllocated")}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span className="inline-flex items-center gap-0.5">
                        Allocated
                        <HelpHint text={COL_HELP.allocated} />
                      </span>
                      <SortIcon colKey="totalAllocated" />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none hover:text-gray-700 text-right whitespace-nowrap" onClick={() => handleSort("totalCommitted")}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span className="inline-flex items-center gap-0.5">
                        Committed
                        <HelpHint text={COL_HELP.committed} />
                      </span>
                      <SortIcon colKey="totalCommitted" />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none hover:text-gray-700 text-right whitespace-nowrap" onClick={() => handleSort("totalExpected")}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span className="inline-flex items-center gap-0.5">
                        Expected
                        <HelpHint text={COL_HELP.expected} />
                      </span>
                      <SortIcon colKey="totalExpected" />
                    </span>
                  </th>
                  <th className="text-right whitespace-nowrap">
                    <span className="inline-flex items-center justify-end gap-0.5 w-full">
                      Calculated
                      <HelpHint text={COL_HELP.calculated} />
                    </span>
                  </th>
                  <th className="cursor-pointer select-none hover:text-gray-700 text-right whitespace-nowrap" onClick={() => handleSort("totalAvailable")}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      <span className="inline-flex items-center gap-0.5">
                        Avail
                        <HelpHint text={COL_HELP.avail} />
                      </span>
                      <SortIcon colKey="totalAvailable" />
                    </span>
                  </th>
                  <th>Stock status</th>
                  <th>Reorder at</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: invColCount }).map((_, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-3.5 bg-gray-200 rounded animate-pulse" style={{ width: "75%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={invColCount} className="text-center text-gray-400 py-12">
                      No inventory levels found
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, i) => {
                    const id = row.variantId;
                    const open = Boolean(expanded[id]);
                    const totalAllocated = num(row.totalAllocated ?? row.levels?.reduce((s, l) => s + levelAllocated(l), 0));
                    const totalCommitted = num(row.totalCommitted ?? row.levels?.reduce((s, l) => s + levelCommitted(l), 0));
                    const totalExpected = num(row.totalExpected ?? row.levels?.reduce((s, l) => s + levelExpected(l), 0));
                    const onHand = num(row.totalOnHand);
                    const calculated = onHand + totalExpected - totalCommitted;
                    const avail = Number(row.totalAvailable ?? 0);
                    const low = row.variant?.reorderPoint && avail <= Number(row.variant.reorderPoint);
                    const expandedLevels = buildExpandedLevels(row, locationOptions, showEmptyWarehouses, locationFilter);

                    return (
                      <Fragment key={id}>
                        <tr
                          className="hover:bg-gray-50/80 cursor-pointer"
                          onClick={() => toggleExpand(id)}
                        >
                          <td className="w-10">
                            <button
                              type="button"
                              className="icon-btn p-1"
                              aria-expanded={open}
                              aria-label={open ? "Collapse" : "Expand"}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(id);
                              }}
                            >
                              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="text-center text-gray-400 text-xs w-10">{i + 1}</td>
                          <td className="font-mono text-sm">{row.variant?.sku || "—"}</td>
                          <td className="font-medium">{row.variant?.product?.name || row.variant?.material?.name || "—"}</td>
                          <td className="tabular-nums font-semibold text-right">{formatQty(row.totalOnHand, rowUom(row))}</td>
                          <td className="tabular-nums text-right text-gray-800">
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-gray-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailVariant(row);
                                setDetailMetric("allocated");
                                setDetailOpen(true);
                              }}
                              title="View orders behind allocated quantity"
                            >
                              {formatQty(totalAllocated, rowUom(row))}
                            </button>
                          </td>
                          <td className="tabular-nums text-right text-amber-900/90">
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-amber-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailVariant(row);
                                setDetailMetric("committed");
                                setDetailOpen(true);
                              }}
                              title="View orders behind committed demand"
                            >
                              {formatQty(totalCommitted, rowUom(row))}
                            </button>
                          </td>
                          <td className="tabular-nums text-right text-sky-900/90">
                            <button
                              type="button"
                              className="underline underline-offset-2 hover:text-sky-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailVariant(row);
                                setDetailMetric("expected");
                                setDetailOpen(true);
                              }}
                              title="View purchase orders behind expected quantity"
                            >
                              {formatQty(totalExpected, rowUom(row))}
                            </button>
                          </td>
                          <td className={`tabular-nums text-right font-medium ${calculated < 0 ? "text-red-600" : "text-gray-800"}`}>
                            {formatQty(calculated, rowUom(row))}
                          </td>
                          <td className={`tabular-nums font-semibold text-right ${avail < 0 ? "text-red-600" : ""}`}>
                            {formatQty(avail, rowUom(row))}
                          </td>
                          <td className="!p-0">
                            {avail <= 0 ? (
                              <StatusCell status="not_available" label="Out of stock" />
                            ) : low ? (
                              <StatusCell status="expected" label="Low stock" />
                            ) : (
                              <StatusCell status="in_stock" />
                            )}
                          </td>
                          <td>
                            <span className="flex items-center gap-1">
                              {row.variant?.reorderPoint ?? "—"}
                              {low && <AlertTriangle size={13} className="text-amber-500" />}
                            </span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-gray-50/90 border-b border-gray-100">
                            <td colSpan={invColCount} className="px-4 py-3">
                              <p className="text-xs font-semibold text-gray-600 mb-2">By location</p>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {expandedLevels.map((lv) => {
                                  const oh = num(lv.onHand);
                                  const allocated = levelAllocated(lv);
                                  const committed = levelCommitted(lv);
                                  const expected = levelExpected(lv);
                                  const av = num(lv.available);
                                  return (
                                    <div
                                      key={lv.locationId}
                                      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs"
                                    >
                                      <p className="font-medium text-gray-900">{lv.location?.name || "—"}</p>
                                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700 tabular-nums">
                                        <dt className="text-gray-500">On hand</dt>
                                        <dd className="text-right font-medium">{formatQty(oh, rowUom(row))}</dd>
                                        <dt className="text-gray-500">Allocated</dt>
                                        <dd className="text-right">{formatQty(allocated, rowUom(row))}</dd>
                                        <dt className="text-gray-500">Committed</dt>
                                        <dd className="text-right text-amber-900/90">{formatQty(committed, rowUom(row))}</dd>
                                        <dt className="text-gray-500">Expected</dt>
                                        <dd className="text-right text-sky-900/90">{formatQty(expected, rowUom(row))}</dd>
                                        <dt className="text-gray-500">Avail</dt>
                                        <dd className={`text-right font-medium ${av < 0 ? "text-red-600" : ""}`}>
                                          {formatQty(av, rowUom(row))}
                                        </dd>
                                      </dl>
                                      {num(lv.committedSalesOrder) + num(lv.committedManufacturingOrder) + num(lv.committedTransferOrder) > 0 && (
                                        <p className="mt-1 text-[11px] text-gray-500">
                                          Commit split: SO {num(lv.committedSalesOrder).toLocaleString()} · MO {num(lv.committedManufacturingOrder).toLocaleString()} · TO {num(lv.committedTransferOrder).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {expandedLevels.length === 0 && (
                                <p className="text-xs text-gray-400">No locations to show.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <DataTable columns={movCols} data={movements || []} isLoading={movLoading} emptyMessage="No movements found" showRank totalLabel="movements" />
      )}

      <Modal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailVariant(null);
        }}
        title={`${detailMetric === "allocated" ? "Allocation details" : detailMetric === "expected" ? "Expected supply details" : "Demand details"}${detailVariant?.variant?.sku ? ` · ${detailVariant.variant.sku}` : ""}`}
        size="lg"
      >
        {demandLoading ? (
          <p className="text-sm text-gray-500">Loading order details…</p>
        ) : !demandDetails ? (
          <p className="text-sm text-gray-500">No details found.</p>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
              Allocated total: <strong>{num(demandDetails.totals.allocated).toLocaleString()}</strong> ·{" "}
              Committed total: <strong>{num(demandDetails.totals.committed).toLocaleString()}</strong> (SO {num(demandDetails.totals.salesOrders).toLocaleString()} · MO {num(demandDetails.totals.manufacturingOrders).toLocaleString()} · TO {num(demandDetails.totals.transferOrders).toLocaleString()}) ·
              Expected total: <strong>{num(demandDetails.totals.expected).toLocaleString()}</strong>
            </div>

            {demandDetails.salesOrderAllocations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Sales orders creating allocation</h3>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th>Location</th>
                      <th className="text-right">Allocated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandDetails.salesOrderAllocations.map((r) => (
                      <tr key={`alloc-${r.salesOrderId}-${r.locationName ?? "na"}-${r.allocatedQty}`}>
                        <td className="font-medium">
                          <Link className="text-brand-700 hover:underline" href={`/dashboard/sell/${r.salesOrderId}`}>
                            {r.salesOrderNumber}
                          </Link>
                        </td>
                        <td>{r.status}</td>
                        <td>{r.customerName || "—"}</td>
                        <td>{r.locationName || "—"}</td>
                        <td className="text-right tabular-nums">{num(r.allocatedQty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {demandDetails.salesOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Sales orders creating demand</h3>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th>Location</th>
                      <th className="text-right">Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandDetails.salesOrders.map((r) => (
                      <tr key={`${r.salesOrderId}-${r.locationName ?? "na"}-${r.demandQty}`}>
                        <td className="font-medium">
                          <Link className="text-brand-700 hover:underline" href={`/dashboard/sell/${r.salesOrderId}`}>
                            {r.salesOrderNumber}
                          </Link>
                        </td>
                        <td>{r.status}</td>
                        <td>{r.customerName || "—"}</td>
                        <td>{r.locationName || "—"}</td>
                        <td className="text-right tabular-nums">{num(r.demandQty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {demandDetails.manufacturingOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Manufacturing orders (component demand)</h3>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>MO</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th className="text-right">Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandDetails.manufacturingOrders.map((r) => (
                      <tr key={`${r.manufacturingOrderId}-${r.locationName ?? "na"}-${r.demandQty}`}>
                        <td className="font-medium">
                          <Link className="text-brand-700 hover:underline" href={`/dashboard/make/${r.manufacturingOrderId}`}>
                            {r.manufacturingOrderNumber}
                          </Link>
                        </td>
                        <td>{r.status}</td>
                        <td>{r.locationName || "—"}</td>
                        <td className="text-right tabular-nums">{num(r.demandQty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {demandDetails.transferOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Transfer orders (from-location demand)</h3>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Transfer</th>
                      <th>Status</th>
                      <th>From</th>
                      <th>To</th>
                      <th className="text-right">Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandDetails.transferOrders.map((r) => (
                      <tr key={`${r.transferOrderId}-${r.demandQty}`}>
                        <td className="font-medium">
                          <Link className="text-brand-700 hover:underline" href="/dashboard/stock/transfers">
                            {r.transferOrderNumber}
                          </Link>
                        </td>
                        <td>{r.status}</td>
                        <td>{r.fromLocationName || "—"}</td>
                        <td>{r.toLocationName || "—"}</td>
                        <td className="text-right tabular-nums">{num(r.demandQty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {demandDetails.purchaseOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Purchase orders (expected supply)</h3>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>PO</th>
                      <th>Status</th>
                      <th>Supplier</th>
                      <th>Location</th>
                      <th className="text-right">Expected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandDetails.purchaseOrders.map((r) => (
                      <tr key={`${r.purchaseOrderId}-${r.expectedQty}`}>
                        <td className="font-medium">
                          <Link className="text-brand-700 hover:underline" href={`/dashboard/buy/${r.purchaseOrderId}`}>
                            {r.purchaseOrderNumber}
                          </Link>
                        </td>
                        <td>{r.status}</td>
                        <td>{r.supplierName || "—"}</td>
                        <td>{r.locationName || "—"}</td>
                        <td className="text-right tabular-nums">{num(r.expectedQty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {demandDetails.salesOrderAllocations.length === 0 &&
              demandDetails.salesOrders.length === 0 &&
              demandDetails.manufacturingOrders.length === 0 &&
              demandDetails.transferOrders.length === 0 &&
              demandDetails.purchaseOrders.length === 0 && (
                <p className="text-sm text-gray-500">No order details for this item at the selected scope.</p>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
}
