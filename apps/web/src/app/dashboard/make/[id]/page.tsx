"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChildTable, ColumnDef, FieldDef } from "@/components/shared/ChildTable";
import { ArrowLeft, Play, CheckCircle, Save, Trash2 } from "lucide-react";
import Link from "next/link";

const recipeRowCols: ColumnDef[] = [
  { key: "material", header: "Material", render: (r: any) => r.variant?.material?.name || r.variant?.sku || "—" },
  { key: "qtyPlanned", header: "Qty Planned" },
];
const recipeRowFields: FieldDef[] = [
  { key: "materialId", label: "Material ID" },
  { key: "variantId", label: "Variant ID", required: true },
  { key: "qtyPlanned", label: "Qty Planned", type: "number", required: true },
];

const opRowCols: ColumnDef[] = [
  { key: "name", header: "Operation" },
  { key: "status", header: "Status" },
  { key: "actualMinutes", header: "Actual (min)" },
];
const opRowFields: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "status", label: "Status", type: "select", options: [
    { value: "not_started", label: "Not Started" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ]},
  { key: "actualMinutes", label: "Actual Minutes", type: "number" },
];

const prodCols: ColumnDef[] = [
  { key: "createdAt", header: "Date", render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
  { key: "qty", header: "Qty" },
  { key: "location", header: "Location", render: (r: any) => r.location?.name || "—" },
];

export default function MODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [produceOpen, setProduceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [editForm, setEditForm] = useState({ status: "", scheduledAt: "", notes: "" });

  const { data: mo, isLoading } = useQuery({ queryKey: ["mo", id], queryFn: () => api.get(`/manufacturing/orders/${id}`).then(r => r.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const produce = useMutation({
    mutationFn: () => api.post(`/manufacturing/orders/${id}/produce`, { locationId, sourceLocationId: sourceLocationId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mo", id] }); addToast("Production complete", "success"); setProduceOpen(false); },
    onError: () => addToast("Error completing production", "error"),
  });

  const updateMO = useMutation({
    mutationFn: (d: any) => api.patch(`/manufacturing/orders/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mo", id] }); addToast("Updated", "success"); setEditOpen(false); },
    onError: () => addToast("Error updating MO", "error"),
  });

  const markDone = useMutation({
    mutationFn: () => api.patch(`/manufacturing/orders/${id}`, { status: "done" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mo", id] }); addToast("Marked as done", "success"); },
    onError: () => addToast("Error marking done", "error"),
  });

  const deleteMO = useMutation({
    mutationFn: () => api.delete(`/manufacturing/orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mfg-orders"] }); addToast("Deleted", "success"); router.push("/dashboard/make"); },
    onError: () => addToast("Error deleting MO", "error"),
  });

  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={6} /></tbody></table></div>;
  if (!mo) return <div className="p-6 text-gray-500">MO not found.</div>;

  const canProduce = ["draft", "released", "in_progress"].includes(mo.status);

  function openEditModal() {
    setEditForm({ status: mo.status || "", scheduledAt: mo.scheduledAt ? mo.scheduledAt.slice(0, 10) : "", notes: mo.notes || "" });
    setEditOpen(true);
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/make" className="icon-btn"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">MO {mo.moNumber}</h1>
          <p className="text-sm text-gray-500">{mo.bom?.name || mo.bom?.variant?.product?.name || "—"}</p>
        </div>
        <StatusBadge status={mo.status} />
        <button className="btn btn-ghost text-sm" onClick={openEditModal}><Save size={14} />Edit</button>
        {mo.status !== "done" && <button className="btn btn-ghost text-sm" onClick={() => markDone.mutate()}><CheckCircle size={14} />Mark Done</button>}
        <button className="btn btn-ghost text-sm text-red-600" onClick={() => { if (window.confirm("Delete this MO?")) deleteMO.mutate(); }}><Trash2 size={14} />Delete</button>
        {canProduce && <button className="btn btn-primary" onClick={() => setProduceOpen(true)}><Play size={15} />Produce</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Qty to Produce</p><p className="text-2xl font-bold text-gray-900">{mo.qty}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Completed</p><p className="text-2xl font-bold text-gray-900">{mo.completedQty || 0}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Scheduled</p><p className="font-medium text-sm">{mo.scheduledAt ? new Date(mo.scheduledAt).toLocaleDateString() : "—"}</p></div>
        <div className="card p-4"><p className="text-gray-500 text-xs mb-1">Completed At</p><p className="font-medium text-sm">{mo.completedAt ? new Date(mo.completedAt).toLocaleDateString() : "—"}</p></div>
      </div>

      <ChildTable
        title="Recipe Rows"
        parentId={id}
        parentKey="moId"
        endpoint="/mo-recipe-rows"
        columns={recipeRowCols}
        formFields={recipeRowFields}
        queryKey="mo-recipe-rows"
      />

      <ChildTable
        title="Operation Rows"
        parentId={id}
        parentKey="moId"
        endpoint="/mo-operation-rows"
        columns={opRowCols}
        formFields={opRowFields}
        queryKey="mo-operation-rows"
      />

      <ChildTable
        title="Production Records"
        parentId={id}
        parentKey="moId"
        endpoint="/mo-productions"
        columns={prodCols}
        formFields={[]}
        queryKey="mo-productions"
        canCreate={false}
        canEdit={false}
        canDelete={false}
      />

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
          <button className="btn btn-primary" disabled={produce.isPending || !locationId} onClick={() => produce.mutate()}>{produce.isPending ? "Producing..." : "Complete"}</button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Manufacturing Order">
        <div className="space-y-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              {["draft", "released", "in_progress", "done", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="label">Scheduled Date</label><input className="input" type="date" value={editForm.scheduledAt} onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={updateMO.isPending} onClick={() => updateMO.mutate(editForm)}>{updateMO.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
