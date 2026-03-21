"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
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

export default function TransfersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [variantId, setVariantId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["transfers"], queryFn: () => api.get("/stock/transfers").then(r => r.data.data) });
  const { data: materials } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then(r => r.data.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const transfer = useMutation({
    mutationFn: () => api.post("/stock/transfers", { variantId, fromLocationId: fromId, toLocationId: toId, qty: Number(qty) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transfers"] }); addToast("Transfer complete", "success"); setVariantId(""); setFromId(""); setToId(""); setQty(""); },
    onError: () => addToast("Error processing transfer", "error"),
  });

  const allVariants = [
    ...(materials || []).flatMap((m: any) => (m.variants || []).map((v: any) => ({ id: v.id, label: `${m.name} (${v.sku})` }))),
    ...(products || []).flatMap((p: any) => (p.variants || []).map((v: any) => ({ id: v.id, label: `${p.name} (${v.sku})` }))),
  ];

  const columns: Column[] = [
    { key: "item", header: "Item", render: (r) => r.variant?.material?.name || r.variant?.product?.name || "—" },
    { key: "from", header: "From", render: (r) => r.fromLocation?.name || "—" },
    { key: "to", header: "To", render: (r) => r.toLocation?.name || "—" },
    { key: "qty", header: "Qty" },
    { key: "status", header: "Status", isStatus: true, render: (r) => <StatusCell status={r.status} />, filterable: false },
    { key: "createdAt", header: "Date", render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3 space-y-4">
        <div className="card p-4">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">New Transfer</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Item</label>
              <select className="input" value={variantId} onChange={e => setVariantId(e.target.value)}>
                <option value="">— Select —</option>
                {allVariants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">From</label>
              <select className="input" value={fromId} onChange={e => setFromId(e.target.value)}>
                <option value="">— Select —</option>
                {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">To</label>
              <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
                <option value="">— Select —</option>
                {(locations || []).filter((l: any) => l.id !== fromId).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Qty</label>
              <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={transfer.isPending || !variantId || !fromId || !toId || !qty} onClick={() => transfer.mutate()}>
            {transfer.isPending ? "Transferring…" : "Transfer"}
          </button>
        </div>
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No transfers" showRank countLabel="transfers" />
      </div>
    </>
  );
}
