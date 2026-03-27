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

const blank = { name: "", rate: "", isDefault: false };

export default function TaxRatesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...blank, id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["tax-rates"],
    queryFn: () => api.get("/tax-rates").then((r) => r.data.data ?? r.data),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (d: any) => (d.id ? api.patch(`/tax-rates/${d.id}`, d) : api.post("/tax-rates", d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-rates"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving tax rate", "error"),
  });

  const deleteTax = useMutation({
    mutationFn: (id: string) => api.delete(`/tax-rates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tax-rates"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting tax rate", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(t: any) { setForm({ id: t.id, name: t.name, rate: t.rate?.toString() || "", isDefault: t.isDefault || false }); setOpen(true); }

  const columns: Column[] = [
    { key: "name", header: "Tax Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "rate", header: "Rate (%)", sortable: true, render: (r: any) => <span className="font-mono">{Number(r.rate || 0).toFixed(2)}%</span> },
    { key: "isDefault", header: "Default", render: (r: any) => r.isDefault ? <span className="badge bg-green-100 text-green-700">Default</span> : "—" },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this tax rate?")) deleteTax.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Tax Rate" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No tax rates found" showRank totalLabel="tax rates" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Tax Rate" : "New Tax Rate"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. VAT 20%" /></div>
          <div><label className="label">Rate (%) *</label><input className="input" type="number" step="0.01" value={form.rate} onChange={e => setForm((f: any) => ({ ...f, rate: e.target.value }))} placeholder="e.g. 20" /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isDefaultTax" checked={form.isDefault} onChange={e => setForm((f: any) => ({ ...f, isDefault: e.target.checked }))} />
            <label htmlFor="isDefaultTax" className="text-sm text-gray-700">Default tax rate</label>
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
