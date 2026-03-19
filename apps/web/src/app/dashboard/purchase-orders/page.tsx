"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: () => api.get("/purchase-orders").then(r => r.data.data) });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/purchase-orders", { supplierId: supplierId || undefined, expectedAt: expectedAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); addToast("Purchase order created", "success"); setOpen(false); setSupplierId(""); setExpectedAt(""); setNotes(""); },
    onError: () => addToast("Error creating PO", "error"),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1><p className="text-sm text-gray-500">Procurement from suppliers</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} className="mr-1" />New PO</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>PO #</th><th>Supplier</th><th>Status</th><th>Expected</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((po: any) => (
                <tr key={po.id}>
                  <td className="font-mono text-sm">{po.poNumber}</td>
                  <td>{po.supplier?.name || "—"}</td>
                  <td><StatusBadge status={po.status} /></td>
                  <td>{po.expectedAt ? new Date(po.expectedAt).toLocaleDateString() : "—"}</td>
                  <td>${Number(po.totalCost || 0).toFixed(2)}</td>
                  <td><Link href={`/dashboard/purchase-orders/${po.id}`} className="text-brand-600 text-sm hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Order">
        <div className="space-y-3">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">— Select supplier —</option>
              {(suppliers || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Expected Delivery</label><input className="input" type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Add line items after creating the PO.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create PO"}</button>
        </div>
      </Modal>
    </div>
  );
}
