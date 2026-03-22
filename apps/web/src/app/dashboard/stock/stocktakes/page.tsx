"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChildTable, ColumnDef, FieldDef } from "@/components/shared/ChildTable";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";

const stRowCols: ColumnDef[] = [
  { key: "variant", header: "SKU", render: (r: any) => r.variant?.sku || "—" },
  { key: "item", header: "Item", render: (r: any) => r.variant?.material?.name || r.variant?.product?.name || "—" },
  { key: "systemQty", header: "Expected", render: (r: any) => r.systemQty ?? r.expectedQty ?? "—" },
  { key: "countedQty", header: "Counted" },
  { key: "variance", header: "Variance", render: (r: any) => {
    const v = (r.countedQty || 0) - (r.systemQty || r.expectedQty || 0);
    return <span className={v < 0 ? "text-red-600 font-medium" : v > 0 ? "text-green-600 font-medium" : "text-gray-400"}>{v > 0 ? "+" : ""}{v}</span>;
  }},
];
const stRowFields: FieldDef[] = [
  { key: "variantId", label: "Variant ID", required: true },
  { key: "countedQty", label: "Counted Qty", type: "number", required: true },
  { key: "systemQty", label: "System Qty", type: "number" },
];

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
    <div className="px-4 py-3 space-y-3">
      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} />New Stocktake</button>
      </div>

      {isLoading ? <div className="card"><table className="table"><tbody><SkeletonRows rows={4} /></tbody></table></div> : (data || []).map((st: any) => (
        <div key={st.id} className="space-y-3">
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpanded(expanded === st.id ? null : st.id)}>
              <div className="flex items-center gap-3">
                {expanded === st.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div>
                  <p className="font-medium text-gray-900">{st.reference || `ST-${st.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-gray-500">{st.location?.name || "All locations"} &middot; {new Date(st.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={st.status} />
                {st.status === "draft" && (
                  <button className="btn btn-ghost text-sm" onClick={e => { e.stopPropagation(); complete.mutate(st.id); }}>Complete</button>
                )}
              </div>
            </div>
          </div>
          {expanded === st.id && (
            <ChildTable
              title="Stocktake Rows"
              parentId={st.id}
              parentKey="stocktakeId"
              endpoint="/stocktake-rows"
              columns={stRowCols}
              formFields={stRowFields}
              queryKey="stocktake-rows"
              canEdit={st.status === "draft"}
              canDelete={st.status === "draft"}
              canCreate={st.status === "draft"}
            />
          )}
        </div>
      ))}

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
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create"}</button>
        </div>
      </Modal>
    </div>
  );
}
