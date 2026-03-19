"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Plus, Pencil } from "lucide-react";

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Suppliers</h1><p className="text-sm text-gray-500">Vendor contacts & lead times</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} className="mr-1" />New Supplier</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Currency</th><th>Lead Time</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((s: any) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.email || "—"}</td>
                  <td>{s.phone || "—"}</td>
                  <td>{s.currency}</td>
                  <td>{s.leadTimeDays ? `${s.leadTimeDays}d` : "—"}</td>
                  <td><button className="icon-btn" onClick={() => openEdit(s)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
