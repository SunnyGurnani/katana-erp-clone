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

const blank = { code: "", name: "", symbol: "", exchangeRate: "1" };

export default function CurrenciesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["currencies"], queryFn: () => api.get("/currencies").then(r => r.data.data || r.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/currencies/${d.id}`, d) : api.post("/currencies", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["currencies"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving currency", "error"),
  });

  const deleteCurrency = useMutation({
    mutationFn: (id: string) => api.delete(`/currencies/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["currencies"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting currency", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(c: any) { setForm({ id: c.id, code: c.code, name: c.name || "", symbol: c.symbol || "", exchangeRate: c.exchangeRate?.toString() || "1" }); setOpen(true); }

  const columns: Column[] = [
    { key: "code", header: "Code", sortable: true, render: (r: any) => <span className="font-mono font-medium">{r.code}</span> },
    { key: "name", header: "Name", sortable: true },
    { key: "symbol", header: "Symbol", render: (r: any) => <span className="text-lg">{r.symbol || "—"}</span> },
    { key: "exchangeRate", header: "Exchange Rate", render: (r: any) => <span className="font-mono">{Number(r.exchangeRate || 1).toFixed(4)}</span> },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this currency?")) deleteCurrency.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Currency" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No currencies found" showRank totalLabel="currencies" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Currency" : "New Currency"}>
        <div className="space-y-3">
          <div><label className="label">Code * (e.g. USD)</label><input className="input" value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={3} /></div>
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. US Dollar" /></div>
          <div><label className="label">Symbol</label><input className="input" value={form.symbol} onChange={e => setForm((f: any) => ({ ...f, symbol: e.target.value }))} placeholder="e.g. $" maxLength={5} /></div>
          <div><label className="label">Exchange Rate</label><input className="input" type="number" step="0.0001" value={form.exchangeRate} onChange={e => setForm((f: any) => ({ ...f, exchangeRate: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
