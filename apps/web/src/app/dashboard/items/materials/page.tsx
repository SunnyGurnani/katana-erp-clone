"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { Pencil, Trash2 } from "lucide-react";
import { UnitOfMeasureField } from "@/components/shared/UnitOfMeasureField";

const blank = { name: "", sku: "", unit: "pcs", unitCost: "", reorderPoint: "", trackLotsAndExpiry: false };

export default function MaterialsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["materials"], queryFn: () => api.get("/materials").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/materials/${d.id}`, d) : api.post("/materials", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving material", "error"),
  });

  const deleteMaterial = useMutation({
    mutationFn: (id: string) => api.delete(`/materials/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["materials"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting material", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(m: any) {
    setForm({
      id: m.id,
      name: m.name,
      sku: m.sku || "",
      unit: m.unitOfMeasure || m.unit || "pcs",
      unitCost: m.purchasePrice || m.unitCost || "",
      reorderPoint: m.reorderPoint || "",
      trackLotsAndExpiry: !!m.trackLotsAndExpiry,
    });
    setOpen(true);
  }

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "sku", header: "SKU", render: (r: any) => <span className="font-mono text-xs">{r.sku || "—"}</span> },
    { key: "unit", header: "Unit", render: (r: any) => r.unitOfMeasure || r.unit || "—" },
    { key: "unitCost", header: "Unit cost", sortable: true, render: (r: any) => <span className="font-medium">${Number(r.purchasePrice || r.unitCost || 0).toFixed(2)}</span> },
    { key: "reorderPoint", header: "Reorder point", render: (r: any) => r.reorderPoint ?? "—" },
    { key: "tracking", header: "Tracking", render: (r: any) => (r.trackLotsAndExpiry ? "Lots + Expiry" : "—") },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this material?")) deleteMaterial.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Material" onAction={openNew}>
        <ExportToolbar resource="materials" />
      </ListToolbar>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No materials found" showRank totalLabel="materials" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Material" : "New Material"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
          <UnitOfMeasureField
            label="Unit of measure"
            labelClassName="label"
            inputClassName="input"
            value={form.unit}
            onChange={(unit) => setForm((f) => ({ ...f, unit }))}
          />
          <div><label className="label">Unit Cost</label><input className="input" type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
          <div><label className="label">Reorder Point</label><input className="input" type="number" value={form.reorderPoint} onChange={e => setForm(f => ({ ...f, reorderPoint: e.target.value }))} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.trackLotsAndExpiry}
              onChange={e => setForm(f => ({ ...f, trackLotsAndExpiry: e.target.checked }))}
            />
            Enable Lot Tracking + Expiry Date Tracking
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                ...form,
                unitOfMeasure: form.unit,
                purchasePrice: form.unitCost,
                trackLotsAndExpiry: !!form.trackLotsAndExpiry,
              })
            }
          >
            {save.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </>
  );
}
