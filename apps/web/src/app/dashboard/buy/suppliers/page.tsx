"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil } from "lucide-react";
import Link from "next/link";

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

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <Link href={`/dashboard/buy/suppliers/${r.id}`} className="font-medium text-brand-600 hover:underline">{r.name}</Link> },
    { key: "email", header: "Email", render: (r: any) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r: any) => r.phone || "—" },
    { key: "currency", header: "Currency" },
    { key: "leadTimeDays", header: "Lead time", render: (r: any) => r.leadTimeDays ? `${r.leadTimeDays}d` : "—" },
    { key: "edit", header: "", filterable: false, render: (r: any) => (
      <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(r); }}><Pencil size={14} /></button>
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Supplier" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No suppliers found" showRank totalLabel="suppliers" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Supplier" : "New Supplier"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
          <div><label className="label">Lead Time (days)</label><input className="input" type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
