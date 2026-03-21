"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

export default function StockAdjustmentsPage() {
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

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold text-gray-800 mb-4">New Adjustment</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
            <label className="label">Qty (+ delta)</label>
            <input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. -5 or +10" />
          </div>
          <div>
            <label className="label">Reason</label>
            <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
              {["correction", "damaged", "expired", "found", "other"].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" disabled={adjust.isPending || !variantId || !locationId || !qty} onClick={() => adjust.mutate()}>
          {adjust.isPending ? "Posting..." : "Post Adjustment"}
        </button>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-800">History</h2></div>
        {isLoading ? <table className="table"><tbody><SkeletonRows rows={5} /></tbody></table> : (
          <table className="table">
            <thead><tr><th>Item</th><th>Location</th><th>Qty</th><th>Reason</th><th>Date</th></tr></thead>
            <tbody>
              {(data || []).map((a: any) => (
                <tr key={a.id}>
                  <td>{a.variant?.material?.name || a.variant?.product?.name || a.variant?.sku || "—"}</td>
                  <td>{a.location?.name || "—"}</td>
                  <td className={Number(a.qty) < 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{a.qty > 0 ? "+" : ""}{a.qty}</td>
                  <td><span className="badge">{a.reason}</span></td>
                  <td className="text-gray-500 text-sm">{new Date(a.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
