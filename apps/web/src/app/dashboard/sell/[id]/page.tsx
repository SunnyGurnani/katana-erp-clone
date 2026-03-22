"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Plus, Truck, Trash2, Copy, Save } from "lucide-react";
import Link from "next/link";

export default function SODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [rowOpen, setRowOpen] = useState(false);
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [fulfillLocationId, setFulfillLocationId] = useState("");
  const [editForm, setEditForm] = useState({ status: "", dueAt: "", notes: "" });

  const { data: so, isLoading } = useQuery({ queryKey: ["so", id], queryFn: () => api.get(`/sales-orders/${id}`).then(r => r.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const addRow = useMutation({
    mutationFn: () => api.post(`/sales-orders/${id}/rows`, { variantId, qty: Number(qty), salePrice: Number(salePrice) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", id] }); addToast("Row added", "success"); setRowOpen(false); setVariantId(""); setQty(""); setSalePrice(""); },
    onError: () => addToast("Error adding row", "error"),
  });

  const fulfill = useMutation({
    mutationFn: () => api.post(`/sales-orders/${id}/fulfill`, { locationId: fulfillLocationId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", id] }); addToast("Order fulfilled", "success"); setFulfillOpen(false); },
    onError: () => addToast("Error fulfilling order", "error"),
  });

  const updateSO = useMutation({
    mutationFn: (d: any) => api.patch(`/sales-orders/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["so", id] }); addToast("Updated", "success"); setEditOpen(false); },
    onError: () => addToast("Error updating SO", "error"),
  });

  const deleteSO = useMutation({
    mutationFn: () => api.delete(`/sales-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Deleted", "success"); router.push("/dashboard/sell"); },
    onError: () => addToast("Error deleting SO", "error"),
  });

  const duplicateSO = useMutation({
    mutationFn: () => api.post(`/sales-orders/${id}/duplicate`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Duplicated", "success"); router.push(`/dashboard/sell/${res.data.id || res.data.data?.id || ""}`); },
    onError: () => addToast("Error duplicating SO", "error"),
  });

  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={6} /></tbody></table></div>;
  if (!so) return <div className="p-6 text-gray-500">SO not found.</div>;

  const canFulfill = ["draft", "confirmed", "partial"].includes(so.status);

  function openEditModal() {
    setEditForm({ status: so.status || "", dueAt: so.dueAt ? so.dueAt.slice(0, 10) : "", notes: so.notes || "" });
    setEditOpen(true);
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/sell" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">SO {so.soNumber}</h1>
          <p className="text-sm text-gray-500">{so.customer?.name || "No customer"}</p>
        </div>
        <StatusBadge status={so.status} />
        <button className="btn btn-ghost text-sm" onClick={openEditModal}><Save size={14} />Edit</button>
        <button className="btn btn-ghost text-sm" onClick={() => duplicateSO.mutate()}><Copy size={14} />Duplicate</button>
        <button className="btn btn-ghost text-sm text-red-600" onClick={() => { if (window.confirm("Delete this sales order?")) deleteSO.mutate(); }}><Trash2 size={14} />Delete</button>
        {canFulfill && <button className="btn btn-primary" onClick={() => setFulfillOpen(true)}><Truck size={15} />Fulfill</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Due</p><p className="font-medium">{so.dueAt ? new Date(so.dueAt).toLocaleDateString() : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Total</p><p className="font-semibold">${Number(so.totalPrice || 0).toFixed(2)}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Lines</p><p className="font-medium">{so.rows?.length || 0}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Notes</p><p className="truncate">{so.notes || "—"}</p></div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Line Items</h2>
          {["draft", "confirmed"].includes(so.status) && (
            <button className="btn btn-ghost text-sm" onClick={() => setRowOpen(true)}><Plus size={14} />Add Row</button>
          )}
        </div>
        <table className="table">
          <thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Sale Price</th><th>Fulfilled</th><th>Line Total</th></tr></thead>
          <tbody>
            {(so.rows || []).map((r: any) => (
              <tr key={r.id}>
                <td className="font-mono text-sm">{r.variant?.sku || "—"}</td>
                <td>{r.variant?.product?.name || r.description || "—"}</td>
                <td>{r.qty}</td>
                <td>${Number(r.salePrice || 0).toFixed(2)}</td>
                <td>{r.fulfilledQty || 0}</td>
                <td>${(Number(r.qty) * Number(r.salePrice || 0)).toFixed(2)}</td>
              </tr>
            ))}
            {!so.rows?.length && <tr><td colSpan={6} className="text-center text-gray-400 py-8">No line items yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={rowOpen} onClose={() => setRowOpen(false)} title="Add Line Item">
        <div className="space-y-3">
          <div>
            <label className="label">Product</label>
            <select className="input" value={variantId} onChange={e => setVariantId(e.target.value)}>
              <option value="">— Select —</option>
              {(products || []).flatMap((p: any) => (p.variants || []).map((v: any) => <option key={v.id} value={v.id}>{p.name} ({v.sku})</option>))}
            </select>
          </div>
          <div><label className="label">Qty</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Sale Price</label><input className="input" type="number" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setRowOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={addRow.isPending} onClick={() => addRow.mutate()}>{addRow.isPending ? "Adding..." : "Add"}</button>
        </div>
      </Modal>

      <Modal open={fulfillOpen} onClose={() => setFulfillOpen(false)} title="Fulfill Order">
        <div className="space-y-3">
          <div>
            <label className="label">Ship From Location</label>
            <select className="input" value={fulfillLocationId} onChange={e => setFulfillLocationId(e.target.value)}>
              <option value="">— Select —</option>
              {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">Stock will be deducted from the selected location.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setFulfillOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={fulfill.isPending || !fulfillLocationId} onClick={() => fulfill.mutate()}>{fulfill.isPending ? "Fulfilling..." : "Confirm Fulfill"}</button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Sales Order">
        <div className="space-y-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {["draft", "confirmed", "partial", "fulfilled", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Due Date</label><input className="input" type="date" value={editForm.dueAt} onChange={e => setEditForm(f => ({ ...f, dueAt: e.target.value }))} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={updateSO.isPending} onClick={() => updateSO.mutate(editForm)}>{updateSO.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
