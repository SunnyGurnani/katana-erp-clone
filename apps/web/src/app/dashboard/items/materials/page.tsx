"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil, Plus } from "lucide-react";

const tabs = [
  { label: "Products", href: "/dashboard/items" },
  { label: "Materials", href: "/dashboard/items/materials" },
  { label: "Services", href: "/dashboard/items/services" },
];

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
    <div key={k}><label className="label">{label}</label><input className="input" type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
  );

  const columns: Column[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "sku", header: "SKU", render: (r) => r.sku || "—" },
    { key: "unit", header: "Unit" },
    { key: "unitCost", header: "Unit cost", render: (r) => <span className="font-medium">{Number(r.unitCost || 0).toFixed(2)} USD</span> },
    { key: "reorderPoint", header: "Reorder point", render: (r) => r.reorderPoint || "—" },
    { key: "actions", header: "", filterable: false, render: (r) => <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil size={14} /></button> },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div />
        <button className="btn-primary text-[13px] py-1.5 px-3 rounded-md inline-flex items-center gap-1.5 font-medium" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} />Material
        </button>
      </div>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No materials found" showRank countLabel="materials" />
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
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
