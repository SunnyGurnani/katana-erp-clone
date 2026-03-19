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

export default function ManufacturingPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [bomId, setBomId] = useState("");
  const [qty, setQty] = useState("1");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["mfg-orders"], queryFn: () => api.get("/manufacturing/orders").then(r => r.data.data) });
  const { data: boms } = useQuery({ queryKey: ["boms"], queryFn: () => api.get("/manufacturing/boms").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/manufacturing/orders", { bomId, qty: Number(qty), scheduledAt: scheduledAt || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mfg-orders"] }); addToast("Manufacturing order created", "success"); setOpen(false); setBomId(""); setQty("1"); setScheduledAt(""); },
    onError: () => addToast("Error creating MO", "error"),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Manufacturing</h1><p className="text-sm text-gray-500">Production orders & BOMs</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} className="mr-1" />New Order</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>MO #</th><th>Product</th><th>Qty</th><th>Status</th><th>Scheduled</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((mo: any) => (
                <tr key={mo.id}>
                  <td className="font-mono text-sm">{mo.moNumber}</td>
                  <td>{mo.bom?.variant?.product?.name || mo.bom?.name || "—"}</td>
                  <td>{mo.qty}</td>
                  <td><StatusBadge status={mo.status} /></td>
                  <td>{mo.scheduledAt ? new Date(mo.scheduledAt).toLocaleDateString() : "—"}</td>
                  <td><Link href={`/dashboard/manufacturing/${mo.id}`} className="text-brand-600 text-sm hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Manufacturing Order">
        <div className="space-y-3">
          <div>
            <label className="label">Bill of Materials</label>
            <select className="input" value={bomId} onChange={e => setBomId(e.target.value)}>
              <option value="">— Select BOM —</option>
              {(boms || []).map((b: any) => <option key={b.id} value={b.id}>{b.name || b.variant?.product?.name || b.id}</option>)}
            </select>
          </div>
          <div><label className="label">Qty to Produce</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Scheduled Date</label><input className="input" type="date" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !bomId} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create MO"}</button>
        </div>
      </Modal>
    </div>
  );
}
