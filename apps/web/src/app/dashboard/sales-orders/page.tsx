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

export default function SalesOrdersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["sales-orders"], queryFn: () => api.get("/sales-orders").then(r => r.data.data) });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/sales-orders", { customerId: customerId || undefined, dueAt: dueAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Sales order created", "success"); setOpen(false); setCustomerId(""); setDueAt(""); setNotes(""); },
    onError: () => addToast("Error creating SO", "error"),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1><p className="text-sm text-gray-500">Customer orders & fulfillment</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} className="mr-1" />New SO</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>SO #</th><th>Customer</th><th>Status</th><th>Due</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((so: any) => (
                <tr key={so.id}>
                  <td className="font-mono text-sm">{so.soNumber}</td>
                  <td>{so.customer?.name || "—"}</td>
                  <td><StatusBadge status={so.status} /></td>
                  <td>{so.dueAt ? new Date(so.dueAt).toLocaleDateString() : "—"}</td>
                  <td>${Number(so.totalPrice || 0).toFixed(2)}</td>
                  <td><Link href={`/dashboard/sales-orders/${so.id}`} className="text-brand-600 text-sm hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Sales Order">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">— Select customer —</option>
              {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Due Date</label><input className="input" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Add line items after creating the SO.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create SO"}</button>
        </div>
      </Modal>
    </div>
  );
}
