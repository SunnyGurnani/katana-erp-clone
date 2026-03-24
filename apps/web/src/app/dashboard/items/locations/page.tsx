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

const blank = { name: "", address: "", isDefault: false };

export default function LocationsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...blank, id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then(r => r.data.data),
  });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/locations/${d.id}`, d) : api.post("/locations", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving location", "error"),
  });

  const deleteLocation = useMutation({
    mutationFn: (id: string) => api.delete(`/locations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting location", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(l: any) { setForm({ id: l.id, name: l.name, address: l.address || "", isDefault: l.isDefault || false }); setOpen(true); }

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "address", header: "Address", render: (r: any) => r.address || "—" },
    { key: "isDefault", header: "Default", render: (r: any) => r.isDefault ? <span className="badge bg-green-100 text-green-700">Default</span> : "—" },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this location?")) deleteLocation.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Location" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No locations found" showRank totalLabel="locations" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Location" : "New Location"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => setForm((f: any) => ({ ...f, isDefault: e.target.checked }))} />
            <label htmlFor="isDefault" className="text-sm text-gray-700">Default location</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
