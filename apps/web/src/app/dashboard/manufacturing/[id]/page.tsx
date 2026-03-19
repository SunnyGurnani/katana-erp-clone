"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";

export default function MODetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [produceOpen, setProduceOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");

  const { data: mo, isLoading } = useQuery({ queryKey: ["mo", id], queryFn: () => api.get(`/manufacturing/orders/${id}`).then(r => r.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const produce = useMutation({
    mutationFn: () => api.post(`/manufacturing/orders/${id}/produce`, { locationId, sourceLocationId: sourceLocationId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mo", id] }); addToast("Production complete", "success"); setProduceOpen(false); },
    onError: () => addToast("Error completing production", "error"),
  });

  if (isLoading) return <div className="p-6"><SkeletonRows rows={6} /></div>;
  if (!mo) return <div className="p-6 text-gray-500">MO not found.</div>;

  const canProduce = ["draft", "released", "in_progress"].includes(mo.status);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/manufacturing" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">MO {mo.moNumber}</h1>
          <p className="text-sm text-gray-500">{mo.bom?.name || mo.bom?.variant?.product?.name || "—"}</p>
        </div>
        <StatusBadge status={mo.status} />
        {canProduce && <button className="btn btn-primary" onClick={() => setProduceOpen(true)}><Play size={15} className="mr-1" />Produce</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Qty to Produce</p><p className="text-2xl font-bold text-gray-900">{mo.qty}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Completed</p><p className="text-2xl font-bold text-gray-900">{mo.completedQty || 0}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Scheduled</p><p className="font-medium text-sm">{mo.scheduledAt ? new Date(mo.scheduledAt).toLocaleDateString() : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Completed At</p><p className="font-medium text-sm">{mo.completedAt ? new Date(mo.completedAt).toLocaleDateString() : "—"}</p></div>
      </div>

      {mo.recipeRows?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-800">Material Requirements</h2></div>
          <table className="table">
            <thead><tr><th>Material</th><th>Qty per Unit</th><th>Total Required</th></tr></thead>
            <tbody>
              {mo.recipeRows.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.variant?.material?.name || r.variant?.sku || "—"}</td>
                  <td>{r.qty}</td>
                  <td className="font-semibold">{Number(r.qty) * Number(mo.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={produceOpen} onClose={() => setProduceOpen(false)} title="Complete Production">
        <div className="space-y-3">
          <div>
            <label className="label">Output to Location *</label>
            <select className="input" value={locationId} onChange={e => setLocationId(e.target.value)}>
              <option value="">— Select —</option>
              {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Consume Materials From</label>
            <select className="input" value={sourceLocationId} onChange={e => setSourceLocationId(e.target.value)}>
              <option value="">— Same as output —</option>
              {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">Materials will be deducted and finished goods added to the selected location.</p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setProduceOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={produce.isPending || !locationId} onClick={() => produce.mutate()}>{produce.isPending ? "Producing…" : "Complete"}</button>
        </div>
      </Modal>
    </div>
  );
}
