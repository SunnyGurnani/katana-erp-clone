"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { Plus, Pencil } from "lucide-react";

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
  function openEdit(p: any) { setForm({ id: p.id, name: p.name, sku: p.variants?.[0]?.sku || "", description: p.description || "", category: p.category || "", unitCost: p.variants?.[0]?.unitCost || "", salePrice: p.variants?.[0]?.salePrice || "", reorderPoint: p.variants?.[0]?.reorderPoint || "" }); setOpen(true); }
  const field = (k: string, label: string, type = "text") => (
    <div key={k}>
      <label className="label">{label}</label>
      <input className="input" type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Products</h1><p className="text-sm text-gray-500">Finished goods & variants</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} className="mr-1" />New Product</button>
      </div>
      <div className="card">
        {isLoading ? <SkeletonRows rows={6} /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Category</th><th>SKU(s)</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((p: any) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.category || "—"}</td>
                  <td>{p.variants?.map((v: any) => v.sku).join(", ") || "—"}</td>
                  <td><StatusBadge status={p.status || "active"} /></td>
                  <td><button className="icon-btn" onClick={() => openEdit(p)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Product" : "New Product"}>
        <div className="space-y-3">
          {field("name", "Name *")}
          {field("sku", "SKU")}
          {field("category", "Category")}
          {field("description", "Description")}
          {field("unitCost", "Unit Cost", "number")}
          {field("salePrice", "Sale Price", "number")}
          {field("reorderPoint", "Reorder Point", "number")}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
