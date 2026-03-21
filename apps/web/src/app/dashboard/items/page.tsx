"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil } from "lucide-react";

const blank = { name: "", sku: "", description: "", category: "", unitCost: "", salePrice: "", reorderPoint: "" };

export default function ProductsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/products/${d.id}`, d) : api.post("/products", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving product", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(p: any) {
    setForm({ id: p.id, name: p.name, sku: p.variants?.[0]?.sku || "", description: p.description || "", category: p.category || "", unitCost: p.variants?.[0]?.unitCost || "", salePrice: p.variants?.[0]?.salePrice || "", reorderPoint: p.variants?.[0]?.reorderPoint || "" });
    setOpen(true);
  }

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "category", header: "Category", render: (r: any) => r.category || "—" },
    { key: "sku", header: "SKU(s)", render: (r: any) => <span className="font-mono text-xs">{r.variants?.map((v: any) => v.sku).join(", ") || "—"}</span> },
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => {
      const s = r.status || "active";
      return <StatusCell status={s === "active" ? "in_stock" : "not_available"} label={s === "active" ? "Active" : "Inactive"} />;
    }},
    { key: "edit", header: "", filterable: false, render: (r: any) => (
      <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(r); }}><Pencil size={14} /></button>
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Product" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No products found" showRank totalLabel="products" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Product" : "New Product"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
          <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Unit Cost</label><input className="input" type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
          <div><label className="label">Sale Price</label><input className="input" type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} /></div>
          <div><label className="label">Reorder Point</label><input className="input" type="number" value={form.reorderPoint} onChange={e => setForm(f => ({ ...f, reorderPoint: e.target.value }))} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
