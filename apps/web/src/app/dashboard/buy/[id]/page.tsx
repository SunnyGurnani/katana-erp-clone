"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Plus, PackageCheck } from "lucide-react";
import Link from "next/link";

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [rowOpen, setRowOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [receiveLocationId, setReceiveLocationId] = useState("");

  const { data: po, isLoading } = useQuery({ queryKey: ["po", id], queryFn: () => api.get(`/purchase-orders/${id}`).then(r => r.data) });
  const { data: materials } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const addRow = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/rows`, { variantId, qty: Number(qty), unitCost: Number(unitCost) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["po", id] }); addToast("Row added", "success"); setRowOpen(false); setVariantId(""); setQty(""); setUnitCost(""); },
    onError: () => addToast("Error adding row", "error"),
  });

  const receive = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${id}/receive`, { locationId: receiveLocationId, rows: (po?.rows || []).map((r: any) => ({ rowId: r.id, receivedQty: Number(r.qty) - Number(r.receivedQty || 0) })) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["po", id] }); addToast("Stock received", "success"); setReceiveOpen(false); },
    onError: () => addToast("Error receiving stock", "error"),
  });

  if (isLoading) return <div className="p-6"><SkeletonRows rows={6} /></div>;
  if (!po) return <div className="p-6 text-gray-500">PO not found.</div>;

  const canReceive = ["draft", "sent", "partial", "confirmed"].includes(po.status);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/buy" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">PO {po.poNumber}</h1>
          <p className="text-sm text-gray-500">{po.supplier?.name || "No supplier"}</p>
        </div>
        <StatusBadge status={po.status} />
        {canReceive && <button className="btn btn-primary" onClick={() => setReceiveOpen(true)}><PackageCheck size={15} className="mr-1" />Receive</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Expected</p><p className="font-medium">{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Total</p><p className="font-semibold">${Number(po.totalCost || 0).toFixed(2)}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Lines</p><p className="font-medium">{po.rows?.length || 0}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Notes</p><p className="truncate">{po.notes || "—"}</p></div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Line Items</h2>
          {["draft", "sent"].includes(po.status) && (
            <button className="btn btn-ghost text-sm" onClick={() => setRowOpen(true)}><Plus size={14} className="mr-1" />Add Row</button>
          )}
        </div>
        <table className="table">
          <thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Received</th><th>Line Total</th></tr></thead>
          <tbody>
            {(po.rows || []).map((r: any) => (
              <tr key={r.id}>
                <td className="font-mono text-sm">{r.variant?.sku || "—"}</td>
                <td>{r.variant?.material?.name || r.variant?.product?.name || r.description || "—"}</td>
                <td>{r.qty}</td>
                <td>${Number(r.unitCost || 0).toFixed(2)}</td>
                <td>{r.receivedQty || 0}</td>
                <td className="font-medium">${(Number(r.qty) * Number(r.unitCost || 0)).toFixed(2)}</td>
              </tr>
            ))}
            {!po.rows?.length && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No line items yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={rowOpen} onClose={() => setRowOpen(false)} title="Add Line Item">
        <div className="space-y-3">
          <div>
            <label className="label">Material/Product</label>
            <select className="input" value={variantId} onChange={e => setVariantId(e.target.value)}>
              <option value="">— Select —</option>
              {(materials || []).flatMap((m: any) => (m.variants || []).map((v: any) => <option key={v.id} value={v.id}>{m.name} ({v.sku})</option>))}
            </select>
          </div>
          <div><label className="label">Qty</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Unit Cost</label><input className="input" type="number" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setRowOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={addRow.isPending} onClick={() => addRow.mutate()}>{addRow.isPending ? "Adding…" : "Add"}</button>
        </div>
      </Modal>

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive Stock">
        <div className="space-y-3">
          <div>
            <label className="label">Receive Into Location</label>
            <select className="input" value={receiveLocationId} onChange={e => setReceiveLocationId(e.target.value)}>
              <option value="">— Select —</option>
              {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">All remaining quantities will be received.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setReceiveOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={receive.isPending || !receiveLocationId} onClick={() => receive.mutate()}>{receive.isPending ? "Receiving…" : "Confirm Receive"}</button>
        </div>
      </Modal>
    </div>
  );
}
