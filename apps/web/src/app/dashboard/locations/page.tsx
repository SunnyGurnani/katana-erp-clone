"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Plus, Pencil } from "lucide-react";

const blank = { name: "", type: "warehouse", address: "" };

export default function LocationsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/locations/${d.id}`, d) : api.post("/locations", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving location", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(l: any) { setForm({ id: l.id, name: l.name, type: l.type || "warehouse", address: l.address || "" }); setOpen(true); }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Locations</h1><p className="text-sm text-gray-500">Warehouses, stores & virtual sites</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} className="mr-1" />New Location</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th>Address</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((l: any) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.name}</td>
                  <td><span className="badge">{l.type}</span></td>
                  <td>{l.address || "—"}</td>
                  <td><button className="icon-btn" onClick={() => openEdit(l)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Location" : "New Location"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {["warehouse", "store", "virtual", "supplier", "customer"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
