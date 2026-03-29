"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { customerOptions } from "@/lib/catalogOptions";

/** Defined in this module so the SO list never crashes if `@/lib/formatDate` fails to resolve (path alias / merge issues). */
function formatSoListDate(iso: string | Date | null | undefined): string {
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

const statuses = [
  { label: "Open", value: "open" },
  { label: "Draft", value: "draft" },
  { label: "Partial", value: "partial" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
];

function getDeliveryStatus(so: any): string {
  if (so.status === "fulfilled") return "done";
  if (so.status === "cancelled") return "cancelled";
  return "not_shipped";
}

function getProductionStatus(so: any): string {
  if (so.status === "fulfilled" || so.status === "done") return "done";
  if (so.status === "in_progress") return "in_progress";
  return "not_started";
}

function getSalesItemsStatus(so: any): string {
  if (so.status === "fulfilled") return "done";
  if (so.status === "partial") return "partial";
  if (!so.rows || so.rows.length === 0) return "not_applicable";
  if ((so.rows || []).some((r: any) => Number(r.qty ?? r.qtyOrdered) <= 0)) return "blocked";
  return "in_stock";
}

export const dynamic = "force-dynamic";

export default function SalesOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("open");
  const [locationId, setLocationId] = useState("");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  const syncSellUrl = useCallback(
    (nextStatus: string, nextLoc: string) => {
      const params = new URLSearchParams();
      params.set("status", nextStatus);
      if (nextLoc) params.set("locationId", nextLoc);
      router.replace(`/dashboard/sell?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const s = searchParams.get("status");
    const loc = searchParams.get("locationId") || "";
    if (s && statuses.some((x) => x.value === s)) setStatus(s);
    setLocationId(loc);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("newSo") === "1") {
      setOpen(true);
      router.replace("/dashboard/sell", { scroll: false });
    }
  }, [router]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sales-orders", status, locationId],
    queryFn: async () => {
      const r = await api.get("/sales-orders", {
        params: { status, ...(locationId ? { locationId } : {}) },
      });
      const body = r.data;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray(body)) return body;
      return [];
    },
    retry: false,
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });
  const custOpts = useMemo(() => customerOptions(customers), [customers]);
  const locationToolbarOpts = useMemo(
    () => (locations || []).map((l: any) => ({ id: l.id, name: l.name })),
    [locations],
  );

  const create = useMutation({
    mutationFn: () => api.post("/sales-orders", { customerId, dueAt: dueAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      // New orders are `draft`; the Open tab hides drafts — switch so the row is visible.
      setStatus("draft");
      setLocationId("");
      syncSellUrl("draft", "");
      addToast("Sales order created (Draft). Add lines on the order page.", "success");
      setOpen(false);
      setCustomerId("");
      setDueAt("");
      setNotes("");
    },
    onError: () => addToast("Error creating SO", "error"),
  });

  const deleteSO = useMutation({
    mutationFn: (id: string) => api.delete(`/sales-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting SO", "error"),
  });

  const duplicateSO = useMutation({
    mutationFn: (id: string) => api.post(`/sales-orders/${id}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
      setStatus("draft");
      setLocationId("");
      syncSellUrl("draft", "");
      addToast("Duplicated (Draft)", "success");
    },
    onError: () => addToast("Error duplicating SO", "error"),
  });

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data || []) {
      const cur = (r.currency || "USD").toUpperCase();
      m.set(cur, (m.get(cur) || 0) + Number(r.totalPrice || 0));
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const columns: Column[] = [
    { key: "createdAt", header: "Created on", sortable: true, render: (r: any) => formatSoListDate(r.createdAt) },
    { key: "soNumber", header: "Order #", sortable: true, render: (r: any) => (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <Link
          href={`/dashboard/sell/${r.id}?listStatus=${encodeURIComponent(status)}`}
          className="text-brand-600 font-medium hover:underline"
          onClick={e => e.stopPropagation()}
        >
          {r.soNumber}
        </Link>
        {(r.rows?.length ?? 0) === 0 && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">Empty</span>
        )}
      </span>
    )},
    { key: "customer", header: "Customer", render: (r: any) => r.customer?.name || "—" },
    { key: "totalPrice", header: "Total amount", sortable: true, render: (r: any) => (
      <span className="font-medium">{`${Number(r.totalPrice || 0).toFixed(2)} ${r.currency || "USD"}`}</span>
    )},
    { key: "dueAt", header: "Delivery deadline", sortable: true, render: (r: any) => {
      if (!r.dueAt) return "—";
      const ymd = formatSoListDate(r.dueAt);
      const overdue = ymd !== "—" && new Date(ymd + "T12:00:00") < new Date() && r.status !== "cancelled";
      return <span className={overdue ? "text-red-600 font-medium" : ""}>{ymd}</span>;
    }},
    { key: "salesItems", header: "Sales items", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={getSalesItemsStatus(r)} /> },
    { key: "production", header: "Production", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={getProductionStatus(r)} /> },
    { key: "delivery", header: "Delivery", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={getDeliveryStatus(r)} /> },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Duplicate", icon: <Copy size={13} />, onClick: () => duplicateSO.mutate(r.id) },
        {
        label: "Delete",
        icon: <Trash2 size={13} />,
        variant: "danger",
        onClick: () => {
          if (window.confirm("Delete this sales order? Fulfilled lines must be reverted first or the server will reject the delete.")) deleteSO.mutate(r.id);
        },
      },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar
        statusFilter={status}
        onStatusChange={(v) => {
          setStatus(v);
          syncSellUrl(v, locationId);
        }}
        statuses={statuses}
        actionLabel="Sales order"
        onAction={() => setOpen(true)}
        locations={locationToolbarOpts}
        locationFilter={locationId}
        onLocationChange={(v) => {
          setLocationId(v);
          syncSellUrl(status, v);
        }}
      >
        <ExportToolbar resource="sales-orders" filters={{ status, ...(locationId ? { locationId } : {}) }} />
      </ListToolbar>
      <div className="px-4 py-3">
        {isError && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Could not load sales orders.{" "}
            {(error as any)?.response?.data?.error || (error as Error)?.message || "Check the API and try again."}
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{(data || []).length} orders</span>
          <span className="text-xs font-medium text-gray-700">
            {totalsByCurrency.length <= 1
              ? `Total: ${(totalsByCurrency[0]?.[1] ?? 0).toFixed(2)} ${totalsByCurrency[0]?.[0] ?? "USD"}`
              : `Totals (by currency): ${totalsByCurrency.map(([c, v]) => `${v.toFixed(2)} ${c}`).join(" · ")}`}
          </span>
        </div>
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/dashboard/sell/${row.id}?listStatus=${encodeURIComponent(status)}`)}
          emptyMessage="No sales orders found"
          showRank
          totalLabel="orders"
        />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Sales Order">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <SearchableSelect
              value={customerId}
              onChange={setCustomerId}
              options={custOpts}
              placeholder="Search customers…"
              emptyOptionLabel="— Select customer —"
              aria-label="Customer"
            />
          </div>
          <div><label className="label">Due Date</label><input className="input" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Add line items after creating the SO.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !customerId} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create SO"}</button>
        </div>
      </Modal>
    </>
  );
}
