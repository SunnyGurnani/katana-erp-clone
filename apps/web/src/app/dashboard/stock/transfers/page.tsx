"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

export default function StockTransfersPage() {
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

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-4">New Transfer</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
        <button className="btn btn-primary" disabled={transfer.isPending || !variantId || !fromId || !toId || !qty} onClick={() => transfer.mutate()}>
          {transfer.isPending ? "Transferring..." : "Transfer"}
        </button>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-800">History</h2></div>
        {isLoading ? <table className="table"><tbody><SkeletonRows rows={5} /></tbody></table> : (
          <table className="table">
            <thead><tr><th>Item</th><th>From</th><th>To</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(data || []).map((t: any) => (
                <tr key={t.id}>
                  <td>{t.variant?.material?.name || t.variant?.product?.name || "—"}</td>
                  <td>{t.fromLocation?.name || "—"}</td>
                  <td>{t.toLocation?.name || "—"}</td>
                  <td>{t.qty}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="text-gray-500 text-sm">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
