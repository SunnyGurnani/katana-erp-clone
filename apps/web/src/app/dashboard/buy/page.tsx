"use client";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { supplierOptions, locationOptions } from "@/lib/catalogOptions";

function formatPoListDate(iso: string | Date | null | undefined): string {
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
  { label: "Sent", value: "sent" },
  { label: "Partial", value: "partial" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("open");
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("newPo") === "1") {
      setOpen(true);
      router.replace("/dashboard/buy", { scroll: false });
    }
  }, [router]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["purchase-orders", status],
    queryFn: async () => {
      const r = await api.get("/purchase-orders", { params: { status } });
      const body = r.data;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray(body)) return body;
      return [];
    },
    retry: false,
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });
  const { data: currencies } = useQuery({ queryKey: ["currencies"], queryFn: () => api.get("/currencies").then(r => r.data.data) });

  const supOpts = useMemo(() => supplierOptions(suppliers), [suppliers]);
  const locOpts = useMemo(() => locationOptions(locations), [locations]);
  const currencyOpts = useMemo(
    () =>
      (currencies || []).length
        ? (currencies || []).map((c: any) => ({
            value: c.code,
            label: c.isBase ? `${c.code} (Base) — ${c.name}` : `${c.code} — ${c.name}`,
          }))
        : [{ value: "USD", label: "USD — US Dollar" }],
    [currencies]
  );

  const create = useMutation({
    mutationFn: () =>
      api.post("/purchase-orders", {
        supplierId: supplierId || undefined,
        locationId: locationId || undefined,
        currency: currency || "USD",
        expectedAt: expectedAt || undefined,
        notes: notes || undefined,
        rows: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      addToast("Purchase order created", "success");
      setOpen(false);
      setSupplierId("");
      setLocationId("");
      setCurrency("USD");
      setExpectedAt("");
      setNotes("");
    },
    onError: () => addToast("Error creating PO", "error"),
  });

  const deletePO = useMutation({
    mutationFn: (id: string) => api.delete(`/purchase-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting PO", "error"),
  });

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data || []) {
      const cur = (r.currency || "USD").toUpperCase();
      m.set(cur, (m.get(cur) || 0) + Number(r.totalCost || 0));
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const columns: Column[] = [
    { key: "createdAt", header: "Created on", sortable: true, render: (r: any) => formatPoListDate(r.createdAt) },
    { key: "poNumber", header: "PO #", sortable: true, render: (r: any) => (
      <Link href={`/dashboard/buy/${r.id}`} className="text-brand-600 font-medium hover:underline" onClick={e => e.stopPropagation()}>
        {r.poNumber}
      </Link>
    )},
    { key: "supplier", header: "Supplier", render: (r: any) => r.supplier?.name || "—" },
    { key: "status", header: "Status", isStatus: true, filterable: true, sortable: true, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "expectedAt", header: "Expected", sortable: true, render: (r: any) => {
      if (!r.expectedAt) return "—";
      const ymd = formatPoListDate(r.expectedAt);
      const overdue = ymd !== "—" && new Date(ymd + "T12:00:00") < new Date() && !["received", "cancelled"].includes(r.status);
      return <span className={overdue ? "text-red-600 font-medium" : ""}>{ymd}</span>;
    }},
    { key: "totalCost", header: "Total", sortable: true, render: (r: any) => <span className="font-medium">{`${Number(r.totalCost || 0).toFixed(2)} ${r.currency || "USD"}`}</span> },
    {
      key: "rows",
      header: "Items",
      render: (r: any) => {
        const n = r.rows?.length || 0;
        if (n === 0) {
          return <span className="text-amber-700 text-sm font-medium">0 lines — add items</span>;
        }
        return <span className="text-gray-500">{n} lines</span>;
      },
    },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu
        aria-label="Purchase order actions"
        actions={[
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this purchase order?")) deletePO.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Purchase order" onAction={() => setOpen(true)}>
        <ExportToolbar resource="purchase-orders" filters={{ status }} />
      </ListToolbar>
      <div className="px-5 py-3">
        {isError && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Could not load purchase orders.{" "}
            {(error as any)?.response?.data?.error || (error as Error)?.message || "Check the API and try again."}
          </div>
        )}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm text-gray-500">{(data || []).length} purchase orders</span>
          <span className="text-sm font-medium text-gray-700">
            {totalsByCurrency.length <= 1
              ? `Total: ${(totalsByCurrency[0]?.[1] ?? 0).toFixed(2)} ${totalsByCurrency[0]?.[0] ?? "USD"}`
              : `Totals: ${totalsByCurrency.map(([c, v]) => `${v.toFixed(2)} ${c}`).join(" · ")}`}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">List total is the sum of each PO&apos;s line totals; $0 drafts are usually incomplete.</p>
        <DataTable columns={columns} data={data || []} isLoading={isLoading} onRowClick={(row) => router.push(`/dashboard/buy/${row.id}`)} emptyMessage="No purchase orders found" showRank totalLabel="purchase orders" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New purchase order">
        <div className="mx-auto w-full max-w-[520px] space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Supplier</label>
            <SearchableSelect
              value={supplierId}
              onChange={setSupplierId}
              options={supOpts}
              placeholder="Search suppliers…"
              emptyOptionLabel="— Select supplier —"
              aria-label="Supplier"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ship to</label>
            <SearchableSelect
              value={locationId}
              onChange={setLocationId}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel="— Optional —"
              aria-label="Ship to location"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Currency</label>
            <SearchableSelect value={currency} onChange={setCurrency} options={currencyOpts} placeholder="Search currency…" aria-label="Currency" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Expected arrival</label>
            <input className="input h-11" type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Notes</label>
            <textarea className="input min-h-[88px] resize-y" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">Add line items on the PO after creating it.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost px-5" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary px-5" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create PO"}</button>
        </div>
      </Modal>
    </>
  );
}
