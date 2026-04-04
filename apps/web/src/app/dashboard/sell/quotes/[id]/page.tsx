"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Plus, Trash2, ArrowRightCircle, Save, X } from "lucide-react";
import Link from "next/link";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { productVariantOptions, customerOptions } from "@/lib/catalogOptions";

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [rowOpen, setRowOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [editForm, setEditForm] = useState({ status: "", validUntil: "", notes: "", customerId: "" });

  const { data: quote, isLoading } = useQuery({ queryKey: ["quote", id], queryFn: () => api.get(`/quotes/${id}`).then(r => r.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const variantOpts = useMemo(() => productVariantOptions(products), [products]);
  const custOpts = useMemo(() => customerOptions(customers), [customers]);

  const addRow = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/rows`, { variantId, qty: Number(qty), unitPrice: Number(unitPrice) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote", id] }); addToast("Row added", "success"); setRowOpen(false); setVariantId(""); setQty(""); setUnitPrice(""); },
    onError: () => addToast("Error adding row", "error"),
  });

  const deleteRow = useMutation({
    mutationFn: (rowId: string) => api.delete(`/quotes/${id}/rows/${rowId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote", id] }); addToast("Row removed", "success"); },
    onError: () => addToast("Error removing row", "error"),
  });

  const updateQuote = useMutation({
    mutationFn: (d: any) => api.patch(`/quotes/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quote", id] }); addToast("Updated", "success"); setEditOpen(false); },
    onError: () => addToast("Error updating quote", "error"),
  });

  const convert = useMutation({
    mutationFn: () => api.post(`/quotes/${id}/convert-to-so`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Converted to sales order", "success"); router.push("/dashboard/sell"); },
    onError: () => addToast("Error converting quote", "error"),
  });

  const deleteQuote = useMutation({
    mutationFn: () => api.delete(`/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Deleted", "success"); router.push("/dashboard/sell/quotes"); },
    onError: () => addToast("Error deleting quote", "error"),
  });

  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={6} /></tbody></table></div>;
  if (!quote) return <div className="p-6 text-gray-500">Quote not found.</div>;

  const canConvert = ["draft", "sent"].includes(quote.status);
  const canEdit = ["draft", "sent"].includes(quote.status);
  const subtotal = (quote.rows || []).reduce((s: number, r: any) => s + Number(r.qty) * Number(r.unitPrice || 0), 0);

  function openEditModal() {
    setEditForm({
      status: quote.status || "",
      validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : "",
      notes: quote.notes || "",
      customerId: quote.customerId || "",
    });
    setEditOpen(true);
  }

  const customerName = (customers || []).find((c: any) => c.id === quote.customerId)?.name;

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-start gap-3">
        <Link href="/dashboard/sell/quotes" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">Quote</p>
          <h1 className="text-xl font-semibold text-gray-900 truncate">
            {quote.number}
            {customerName ? <span className="text-gray-700 font-medium"> {customerName}</span> : null}
          </h1>
        </div>
        <StatusBadge status={quote.status} />
        <button className="btn btn-ghost text-sm h-9" onClick={openEditModal}><Save size={14} />Edit</button>
        <button className="btn btn-ghost text-sm h-9 text-red-600" onClick={() => { if (window.confirm("Delete this quote?")) deleteQuote.mutate(); }}><Trash2 size={14} />Delete</button>
        {canConvert && <button className="btn btn-primary h-9" onClick={() => convert.mutate()}><ArrowRightCircle size={15} />Convert to SO</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Status</p><p className="font-medium text-sm capitalize">{quote.status}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Customer</p><p className="font-medium text-sm">{customerName || "---"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Valid Until</p><p className="font-medium text-sm">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "---"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Total</p><p className="text-2xl font-bold text-gray-900">${subtotal.toFixed(2)}</p></div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Line Items</h2>
          {canEdit && <button className="btn btn-ghost text-sm" onClick={() => setRowOpen(true)}><Plus size={14} />Add Item</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th className="w-10">#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Line Total</th>{canEdit && <th className="w-12"></th>}</tr>
            </thead>
            <tbody>
              {(quote.rows || []).map((r: any, i: number) => (
                <tr key={r.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td><span className="font-medium text-gray-900">{r.variant?.sku ? `[${r.variant.sku}] ` : ""}{r.variant?.product?.name || r.description || "---"}</span></td>
                  <td>{r.qty}</td>
                  <td>${Number(r.unitPrice || 0).toFixed(2)}</td>
                  <td className="font-medium">${(Number(r.qty) * Number(r.unitPrice || 0)).toFixed(2)}</td>
                  {canEdit && <td><button className="icon-btn text-red-500" onClick={() => deleteRow.mutate(r.id)}><X size={14} /></button></td>}
                </tr>
              ))}
              {!(quote.rows || []).length && <tr><td colSpan={canEdit ? 6 : 5} className="text-center text-gray-400 py-8">No line items yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-5 py-3 border-t border-gray-100">
          <div className="text-sm"><span className="text-gray-500">Subtotal: </span><span className="font-semibold text-gray-900">${subtotal.toFixed(2)} {quote.currency || "USD"}</span></div>
        </div>
      </div>

      {quote.notes && (
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}

      <Modal open={rowOpen} onClose={() => setRowOpen(false)} title="Add Line Item">
        <div className="space-y-3">
          <div>
            <label className="label">Item *</label>
            <SearchableSelect value={variantId} onChange={setVariantId} options={variantOpts} placeholder="Search items..." emptyOptionLabel="--- Select ---" aria-label="Item" />
          </div>
          <div><label className="label">Qty *</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Unit Price</label><input className="input" type="number" step="any" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setRowOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={addRow.isPending || !variantId || !qty} onClick={() => addRow.mutate()}>{addRow.isPending ? "Adding..." : "Add"}</button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Quote">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <SearchableSelect value={editForm.customerId} onChange={v => setEditForm(f => ({ ...f, customerId: v }))} options={custOpts} placeholder="Search customers..." emptyOptionLabel="--- Select ---" aria-label="Customer" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {["draft", "sent", "accepted", "rejected", "expired"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Valid Until</label><input className="input" type="date" value={editForm.validUntil} onChange={e => setEditForm(f => ({ ...f, validUntil: e.target.value }))} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={updateQuote.isPending} onClick={() => updateQuote.mutate(editForm)}>{updateQuote.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
