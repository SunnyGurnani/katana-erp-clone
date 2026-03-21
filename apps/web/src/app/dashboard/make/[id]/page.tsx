"use client";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MODetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: mo, isLoading } = useQuery({ queryKey: ["mo", id], queryFn: () => api.get(`/manufacturing/orders/${id}`).then(r => r.data) });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/manufacturing/orders/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mo", id] }); addToast("Status updated", "success"); },
    onError: () => addToast("Error updating MO", "error"),
  });

  if (isLoading) return <div className="p-6"><SkeletonRows rows={6} /></div>;
  if (!mo) return <div className="p-6 text-gray-500">MO not found.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/make" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">MO {mo.moNumber}</h1>
          <p className="text-sm text-gray-500">{mo.bom?.variant?.product?.name || mo.bom?.name || "—"}</p>
        </div>
        <StatusBadge status={mo.status} />
        {mo.status === "draft" && <button className="btn btn-primary" onClick={() => updateStatus.mutate("in_progress")}>Start Production</button>}
        {mo.status === "in_progress" && <button className="btn btn-primary" onClick={() => updateStatus.mutate("done")}>Mark Done</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Qty Planned</p><p className="font-semibold">{mo.qty}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Qty Produced</p><p className="font-semibold">{mo.qtyProduced || 0}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Scheduled</p><p className="font-medium">{mo.scheduledAt ? new Date(mo.scheduledAt).toLocaleDateString() : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Notes</p><p className="truncate">{mo.notes || "—"}</p></div>
      </div>

      {mo.recipeRows?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-800">Recipe / Ingredients</h2></div>
          <table className="table">
            <thead><tr><th>Material</th><th>Qty Planned</th><th>Qty Consumed</th></tr></thead>
            <tbody>
              {mo.recipeRows.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.material?.name || r.variant?.sku || "—"}</td>
                  <td>{Number(r.qtyPlanned)}</td>
                  <td>{Number(r.qtyConsumed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mo.operationRows?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-800">Operations</h2></div>
          <table className="table">
            <thead><tr><th>Operation</th><th>Status</th><th>Duration</th></tr></thead>
            <tbody>
              {mo.operationRows.map((op: any) => (
                <tr key={op.id}>
                  <td className="font-medium">{op.name}</td>
                  <td><StatusBadge status={op.status} /></td>
                  <td>{op.actualMinutes ? `${op.actualMinutes}m` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
