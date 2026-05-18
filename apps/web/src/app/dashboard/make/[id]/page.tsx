"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChildTable, ColumnDef, FieldDef } from "@/components/shared/ChildTable";
import { Play, CheckCircle, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { locationOptions } from "@/lib/catalogOptions";
import { formatQty } from "@/lib/formatQty";

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
  const { data: materials } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then((r) => r.data.data) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then((r) => r.data.data) });
  const locOpts = useMemo(() => locationOptions(locations), [locations]);
  const materialById = useMemo(() => {
    const map = new Map<string, any>();
    (materials || []).forEach((m: any) => map.set(m.id, m));
    return map;
  }, [materials]);
  const variantById = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => (p.variants || []).forEach((v: any) => map.set(v.id, { ...v, product: p })));
    return map;
  }, [products]);
  const recipeRowCols: ColumnDef[] = useMemo(
    () => [
      {
        key: "material",
        header: "Material",
        render: (r: any) => {
          const m = r.material || (r.materialId ? materialById.get(r.materialId) : undefined);
          const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
          if (m) return m.sku ? `${m.name} (${m.sku})` : m.name;
          if (v) return v.sku ? `[${v.sku}] ${v.product?.name || v.name || "—"}` : v.product?.name || v.name || "—";
          return r.materialId || r.variantId || "—";
        },
      },
      {
        key: "qtyPlanned",
        header: "Qty Planned",
        render: (r: any) => {
          const m = r.material || (r.materialId ? materialById.get(r.materialId) : undefined);
          const v = r.variant || (r.variantId ? variantById.get(r.variantId) : undefined);
          const uom = m?.unitOfMeasure || v?.product?.unitOfMeasure || "pcs";
          return formatQty(r.qtyPlanned, uom);
        },
      },
    ],
    [materialById, variantById]
  );

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

  if (isLoading) return (
    <div className="p-8 space-y-6 page-transition">
      <div className="flex justify-between"><div className="h-8 w-1/3 bg-gray-200 rounded animate-pulse" /><div className="h-8 w-24 bg-gray-200 rounded animate-pulse" /></div>
      <div className="grid grid-cols-4 gap-4 mt-8"><div className="h-10 bg-gray-100 rounded animate-pulse" /><div className="h-10 bg-gray-100 rounded animate-pulse" /><div className="h-10 bg-gray-100 rounded animate-pulse" /></div>
      <div className="h-64 w-full bg-gray-100 rounded animate-pulse mt-8" />
    </div>
  );
  if (!mo) return <div className="p-6 text-gray-500">MO not found.</div>;

  const canProduce = ["draft", "released", "in_progress"].includes(mo.status);

  function openEditModal() {
    setEditForm({ status: mo.status || "", scheduledAt: mo.scheduledAt ? mo.scheduledAt.slice(0, 10) : "", notes: mo.notes || "" });
    setEditOpen(true);
  }

  const productName = mo.bom?.variant?.product?.name || mo.bom?.name || "—";
  const variantLabel = mo.bom?.variant?.sku ? `[${mo.bom.variant.sku}] ${productName}` : productName;
  const moUom = mo.bom?.variant?.product?.unitOfMeasure || "pcs";

  return (
    <div className="space-y-0">
      {/* Katana-style MO detail header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Manufacturing order</p>
              <h1 className="text-lg font-bold text-gray-900">{mo.moNumber} {variantLabel}</h1>
            </div>
            <div className="flex items-center gap-2">
              {canProduce && <button className="btn btn-primary text-sm" onClick={() => setProduceOpen(true)}>Produce</button>}
              {mo.status !== "done" && <button className="btn btn-ghost text-sm" onClick={() => markDone.mutate()}>Mark Done</button>}
              <StatusBadge status={mo.status} />
              <span className="text-sm text-yellow-600 font-medium ml-1">{updateMO.isPending ? "Saving..." : "All changes saved"}</span>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" onClick={openEditModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
              <Link href="/dashboard/make" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </Link>
            </div>
          </div>

          {/* Katana-style field grid */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            <div>
              <label className="klabel">Manufacturing order #</label>
              <p className="text-sm font-medium border-b border-gray-300 pb-2">{mo.moNumber}</p>
            </div>
            <div>
              <label className="klabel">Production deadline</label>
              <p className="text-sm border-b border-gray-300 pb-2">{mo.scheduledAt ? new Date(mo.scheduledAt).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <label className="klabel">Created date</label>
              <p className="text-sm border-b border-gray-300 pb-2">{mo.createdAt ? new Date(mo.createdAt).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <label className="klabel">Product</label>
              <p className="text-sm font-medium border-b border-gray-300 pb-2">{variantLabel}</p>
            </div>
            <div>
              <label className="klabel">Planned quantity</label>
              <p className="text-sm font-medium border-b border-gray-300 pb-2">{formatQty(mo.qty, moUom)}</p>
            </div>
            <div>
              <label className="klabel">Actual quantity</label>
              <p className="text-sm border-b border-gray-300 pb-2">{formatQty(mo.completedQty || 0, moUom)}</p>
            </div>
            <div>
              <label className="klabel">Total Cost</label>
              <p className="text-sm border-b border-gray-300 pb-2">—</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients section — Katana style */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Ingredients</h2>
          <span className="text-sm text-blue-600 cursor-pointer hover:underline">Open product BOM ↗</span>
        </div>
        <ChildTable
          title=""
          parentId={id}
          parentKey="moId"
          endpoint="/mo-recipe-rows"
          columns={recipeRowCols}
          formFields={recipeRowFields}
          queryKey="mo-recipe-rows"
        />
      </div>

      {/* Operations section — Katana style */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Operations</h2>
          <span className="text-sm text-blue-600 cursor-pointer hover:underline">Open product operations ↗</span>
        </div>
        <ChildTable
          title=""
          parentId={id}
          parentKey="moId"
          endpoint="/mo-operation-rows"
          columns={opRowCols}
          formFields={opRowFields}
          queryKey="mo-operation-rows"
        />
      </div>

      {/* Production Records */}
      <div className="px-6 py-4">
        <h2 className="text-base font-bold text-gray-900 mb-3">Production Records</h2>
        <ChildTable
          title=""
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
      </div>

      <Modal open={produceOpen} onClose={() => setProduceOpen(false)} title="Complete Production">
        <div className="space-y-3">
          <div>
            <label className="label">Output to location *</label>
            <SearchableSelect
              value={locationId}
              onChange={setLocationId}
              options={locOpts}
              placeholder="Search locations…"
              emptyOptionLabel="— Select —"
              aria-label="Output location"
            />
          </div>
          <div>
            <label className="label">Consume materials from</label>
            <SearchableSelect
              value={sourceLocationId}
              onChange={setSourceLocationId}
              options={[{ value: "", label: "— Same as output —" }, ...locOpts]}
              placeholder="Search locations…"
              aria-label="Source location"
            />
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
