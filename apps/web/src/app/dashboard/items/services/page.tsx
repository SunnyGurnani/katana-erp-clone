"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { Pencil, Trash2 } from "lucide-react";

const blank = { name: "", sku: "", description: "", price: "", trackLots: false, trackExpiry: false };

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

  const deleteService = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["services"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting service", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(s: any) {
    setForm({
      id: s.id,
      name: s.name,
      sku: s.sku || "",
      description: s.description || "",
      price: s.price || "",
      trackLots: !!s.trackLots,
      trackExpiry: !!s.trackExpiry,
    });
    setOpen(true);
  }

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "sku", header: "SKU", render: (r: any) => <span className="font-mono text-xs">{r.sku || "—"}</span> },
    { key: "description", header: "Description", render: (r: any) => r.description || "—" },
    { key: "price", header: "Price", sortable: true, render: (r: any) => <span className="font-medium">${Number(r.price || 0).toFixed(2)}</span> },
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => {
      const active = r.isActive !== false;
      return <StatusCell status={active ? "in_stock" : "not_available"} label={active ? "Active" : "Inactive"} />;
    }},
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this service?")) deleteService.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Service" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No services found" showRank totalLabel="services" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Service" : "New Service"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Price</label><input className="input" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.trackLots} onChange={e => setForm(f => ({ ...f, trackLots: e.target.checked }))} />
            Enable lot number tracking
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.trackExpiry} onChange={e => setForm(f => ({ ...f, trackExpiry: e.target.checked }))} />
            Enable expiry date tracking
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
