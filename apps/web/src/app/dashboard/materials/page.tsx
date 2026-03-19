"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Plus, Pencil } from "lucide-react";

const blank = { name: "", sku: "", unit: "pcs", unitCost: "", reorderPoint: "" };

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

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(m: any) { setForm({ id: m.id, name: m.name, sku: m.sku || "", unit: m.unit || "pcs", unitCost: m.unitCost || "", reorderPoint: m.reorderPoint || "" }); setOpen(true); }
  const field = (k: string, label: string, type = "text") => (
    <div key={k}>
      <label className="label">{label}</label>
      <input className="input" type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Materials</h1><p className="text-sm text-gray-500">Raw materials & components</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} className="mr-1" />New Material</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>SKU</th><th>Unit</th><th>Unit Cost</th><th>Reorder Point</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((m: any) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name}</td>
                  <td>{m.sku || "—"}</td>
                  <td>{m.unit}</td>
                  <td>${Number(m.unitCost || 0).toFixed(2)}</td>
                  <td>{m.reorderPoint}</td>
                  <td><button className="icon-btn" onClick={() => openEdit(m)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Material" : "New Material"}>
        <div className="space-y-3">
          {field("name", "Name *")}
          {field("sku", "SKU")}
          {field("unit", "Unit")}
          {field("unitCost", "Unit Cost", "number")}
          {field("reorderPoint", "Reorder Point", "number")}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
