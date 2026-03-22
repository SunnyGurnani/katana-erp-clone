"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { Pencil, Trash2 } from "lucide-react";

const blank = { name: "", email: "", phone: "", address: "", currency: "USD" };

export default function CustomersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/customers/${d.id}`, d) : api.post("/customers", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving customer", "error"),
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting customer", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(c: any) { setForm({ id: c.id, name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", currency: c.currency || "USD" }); setOpen(true); }

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "code", header: "Code", render: (r: any) => r.code || "—" },
    { key: "email", header: "Email", render: (r: any) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r: any) => r.phone || "—" },
    { key: "currency", header: "Currency" },
    { key: "orders", header: "# Orders", render: (r: any) => r.salesOrders?.length || r._count?.salesOrders || "—" },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this customer?")) deleteCustomer.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Customer" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No customers found" showRank totalLabel="customers" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Customer" : "New Customer"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><label className="label">Currency</label><input className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
