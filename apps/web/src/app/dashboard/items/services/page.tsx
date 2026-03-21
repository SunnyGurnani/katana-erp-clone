"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil, Plus } from "lucide-react";

const tabs = [
  { label: "Products", href: "/dashboard/items" },
  { label: "Materials", href: "/dashboard/items/materials" },
  { label: "Services", href: "/dashboard/items/services" },
];

const blank = { name: "", sku: "", description: "", price: "" };

export default function ServicesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["services"], queryFn: () => api.get("/services").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/services/${d.id}`, d) : api.post("/services", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving service", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(s: any) { setForm({ id: s.id, name: s.name, sku: s.sku || "", description: s.description || "", price: s.price || "" }); setOpen(true); }

  const field = (k: string, label: string, type = "text") => (
    <div key={k}><label className="label">{label}</label><input className="input" type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
  );

  const columns: Column[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "sku", header: "SKU", render: (r) => r.sku || "—" },
    { key: "description", header: "Description", render: (r) => r.description || "—" },
    { key: "price", header: "Price", render: (r) => r.price ? <span className="font-medium">{Number(r.price).toFixed(2)} USD</span> : "—" },
    { key: "status", header: "Status", isStatus: true, render: (r) => <StatusCell status={r.isActive !== false ? "active" : "inactive"} />, filterable: false },
    { key: "actions", header: "", filterable: false, render: (r) => <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil size={14} /></button> },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div />
        <button className="btn-primary text-[13px] py-1.5 px-3 rounded-md inline-flex items-center gap-1.5 font-medium" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} />Service
        </button>
      </div>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No services found" showRank countLabel="services" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Service" : "New Service"}>
        <div className="space-y-3">
          {field("name", "Name *")}
          {field("sku", "SKU")}
          {field("description", "Description")}
          {field("price", "Price", "number")}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
