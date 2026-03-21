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
  { label: "Purchase orders", href: "/dashboard/buy" },
  { label: "Outsourcing", href: "/dashboard/buy/outsourcing" },
  { label: "Suppliers", href: "/dashboard/buy/suppliers" },
];

const blank = { name: "", email: "", phone: "", address: "", currency: "USD", leadTimeDays: "" };

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/suppliers/${d.id}`, d) : api.post("/suppliers", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving supplier", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(s: any) { setForm({ id: s.id, name: s.name, email: s.email || "", phone: s.phone || "", address: s.address || "", currency: s.currency || "USD", leadTimeDays: s.leadTimeDays || "" }); setOpen(true); }

  const field = (k: string, label: string, type = "text") => (
    <div key={k}><label className="label">{label}</label><input className="input" type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
  );

  const columns: Column[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
    { key: "currency", header: "Currency" },
    { key: "leadTimeDays", header: "Lead time", render: (r) => r.leadTimeDays ? `${r.leadTimeDays}d` : "—" },
    { key: "actions", header: "", filterable: false, render: (r) => <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil size={14} /></button> },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div />
        <button className="btn-primary text-[13px] py-1.5 px-3 rounded-md inline-flex items-center gap-1.5 font-medium" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} />Supplier
        </button>
      </div>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No suppliers found" showRank countLabel="suppliers" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Supplier" : "New Supplier"}>
        <div className="space-y-3">
          {field("name", "Name *")}
          {field("email", "Email", "email")}
          {field("phone", "Phone")}
          {field("address", "Address")}
          {field("currency", "Currency")}
          {field("leadTimeDays", "Lead Time (days)", "number")}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
