"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";

const tabs = [
  { label: "Inventory", href: "/dashboard/stock" },
  { label: "Batches", href: "/dashboard/stock/batches" },
  { label: "Adjustments", href: "/dashboard/stock/adjustments" },
  { label: "Transfers", href: "/dashboard/stock/transfers" },
  { label: "Stocktakes", href: "/dashboard/stock/stocktakes" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function AdjustmentsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [variantId, setVariantId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("correction");

  const { data, isLoading } = useQuery({ queryKey: ["adjustments"], queryFn: () => api.get("/stock/adjustments").then(r => r.data.data) });
  const { data: materials } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then(r => r.data.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const adjust = useMutation({
    mutationFn: () => api.post("/stock/adjustments", { variantId, locationId, qty: Number(qty), reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["adjustments"] }); addToast("Adjustment posted", "success"); setVariantId(""); setLocationId(""); setQty(""); },
    onError: () => addToast("Error posting adjustment", "error"),
  });

  const allVariants = [
    ...(materials || []).flatMap((m: any) => (m.variants || []).map((v: any) => ({ id: v.id, label: `${m.name} (${v.sku})` }))),
    ...(products || []).flatMap((p: any) => (p.variants || []).map((v: any) => ({ id: v.id, label: `${p.name} (${v.sku})` }))),
  ];

  const columns: Column[] = [
    { key: "item", header: "Item", render: (r) => r.variant?.material?.name || r.variant?.product?.name || r.variant?.sku || "—" },
    { key: "location", header: "Location", render: (r) => r.location?.name || "—" },
    { key: "qty", header: "Qty", render: (r) => <span className={Number(r.qty) < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{Number(r.qty) > 0 ? "+" : ""}{r.qty}</span> },
    { key: "reason", header: "Reason", render: (r) => <span className="badge">{r.reason}</span> },
    { key: "createdAt", header: "Date", render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3 space-y-4">
        <div className="card p-4">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">New Adjustment</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Item</label>
              <select className="input" value={variantId} onChange={e => setVariantId(e.target.value)}>
                <option value="">— Select —</option>
                {allVariants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <select className="input" value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">— Select —</option>
                {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Qty (± delta)</label>
              <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. -5 or +10" />
            </div>
            <div>
              <label className="label">Reason</label>
              <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                {["correction", "damaged", "expired", "found", "other"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={adjust.isPending || !variantId || !locationId || !qty} onClick={() => adjust.mutate()}>
            {adjust.isPending ? "Posting…" : "Post Adjustment"}
          </button>
        </div>
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No adjustments" showRank countLabel="adjustments" />
      </div>
    </>
  );
}
