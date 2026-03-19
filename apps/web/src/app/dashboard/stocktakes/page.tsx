"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";


export default function StocktakesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["stocktakes"], queryFn: () => api.get("/stock/stocktakes").then(r => r.data.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/stock/stocktakes", { locationId: locationId || undefined, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stocktakes"] }); addToast("Stocktake created", "success"); setOpen(false); setLocationId(""); setNotes(""); },
    onError: () => addToast("Error creating stocktake", "error"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.post(`/stock/stocktakes/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stocktakes"] }); addToast("Stocktake completed", "success"); },
    onError: () => addToast("Error completing stocktake", "error"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Stocktakes</h1><p className="text-sm text-gray-500">Physical inventory counts</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} className="mr-1" />New Stocktake</button>
      </div>

      <div className="space-y-3">
        {isLoading ? <div className="card"><SkeletonRows rows={4} /></div> : (data || []).map((st: any) => (
          <div key={st.id} className="card">
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpanded(expanded === st.id ? null : st.id)}>
              <div className="flex items-center gap-3">
                {expanded === st.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div>
                  <p className="font-medium text-gray-900">{st.reference || `ST-${st.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-gray-500">{st.location?.name || "All locations"} · {new Date(st.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={st.status} />
                {st.status === "draft" && (
                  <button className="btn btn-ghost text-sm" onClick={e => { e.stopPropagation(); complete.mutate(st.id); }}>
                    Complete
                  </button>
                )}
              </div>
            </div>
            {expanded === st.id && st.rows?.length > 0 && (
              <div className="border-t border-gray-200">
                <table className="table">
                  <thead><tr><th>SKU</th><th>Item</th><th>Expected</th><th>Counted</th><th>Variance</th></tr></thead>
                  <tbody>
                    {st.rows.map((r: any) => {
                      const variance = (r.countedQty || 0) - (r.expectedQty || 0);
                      return (
                        <tr key={r.id}>
                          <td className="font-mono text-sm">{r.variant?.sku || "—"}</td>
                          <td>{r.variant?.material?.name || r.variant?.product?.name || "—"}</td>
                          <td>{r.expectedQty}</td>
                          <td>{r.countedQty}</td>
                          <td className={variance < 0 ? "text-red-600 font-medium" : variance > 0 ? "text-green-600 font-medium" : "text-gray-400"}>{variance > 0 ? "+" : ""}{variance}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Stocktake">
        <div className="space-y-3">
          <div>
            <label className="label">Location (optional)</label>
            <select className="input" value={locationId} onChange={e => setLocationId(e.target.value)}>
              <option value="">All locations</option>
              {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create"}</button>
        </div>
      </Modal>
    </div>
  );
}
