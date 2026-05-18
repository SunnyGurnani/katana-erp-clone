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
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { UnitOfMeasureField } from "@/components/shared/UnitOfMeasureField";

const blank = { name: "", sku: "", description: "", category: "", unitOfMeasure: "pcs", salesPrice: "", purchasePrice: "", trackLotsAndExpiry: false };

export default function ProductsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ 
    queryKey: ["products"], 
    queryFn: () => api.get("/products").then(r => r.data.data) 
  });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/products/${d.id}`, d) : api.post("/products", d),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["products"] }); 
      addToast("Saved", "success"); 
      setOpen(false); 
    },
    onError: () => addToast("Error saving product", "error"),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["products"] }); 
      addToast("Deleted", "success"); 
    },
    onError: () => addToast("Error deleting product", "error"),
  });

  function openNew() { 
    setForm({ ...blank, id: "" }); 
    setOpen(true); 
  }

  function openEdit(p: any) {
    setForm({
      id: p.id,
      name: p.name,
      sku: p.variants?.[0]?.sku || "",
      description: p.description || "",
      category: p.category || "",
      unitOfMeasure: p.unitOfMeasure || "pcs",
      salesPrice: p.salesPrice?.toString() || "",
      purchasePrice: p.purchasePrice?.toString() || "",
      trackLotsAndExpiry: !!p.trackLotsAndExpiry,
    });
    setOpen(true);
  }

  const columns: Column[] = [
    { 
      key: "name", 
      header: "Name", 
      sortable: true, 
      render: (r: any) => (
        <Link 
          href={`/dashboard/items/products/${r.id}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {r.name}
        </Link>
      )
    },
    { key: "category", header: "Category", render: (r: any) => r.category || "—" },
    { 
      key: "sku", 
      header: "SKU(s)", 
      render: (r: any) => (
        <span className="font-mono text-xs">
          {r.variants?.map((v: any) => v.sku).filter(Boolean).join(", ") || "—"}
        </span>
      )
    },
    { 
      key: "salesPrice", 
      header: "Sales Price", 
      render: (r: any) => r.salesPrice ? `$${Number(r.salesPrice).toFixed(2)}` : "—" 
    },
    { 
      key: "purchasePrice", 
      header: "Purchase Price", 
      render: (r: any) => r.purchasePrice ? `$${Number(r.purchasePrice).toFixed(2)}` : "—" 
    },
    { 
      key: "tracking", 
      header: "Tracking", 
      render: (r: any) => {
        const badges = [];
        if (r.trackLotsAndExpiry) badges.push("Lots + Expiry");
        return badges.length > 0 ? badges.join(", ") : "—";
      }
    },
    { 
      key: "status", 
      header: "Status", 
      isStatus: true, 
      filterable: false, 
      render: (r: any) => {
        const active = r.isActive !== false;
        return <StatusCell status={active ? "in_stock" : "not_available"} label={active ? "Active" : "Inactive"} />;
      }
    },
    { 
      key: "actions", 
      header: "", 
      filterable: false, 
      render: (r: any) => (
        <ActionMenu actions={[
          { 
            label: "View Details", 
            icon: <Eye size={13} />, 
            onClick: () => window.open(`/dashboard/items/products/${r.id}`, '_blank') 
          },
          { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
          { 
            label: "Delete", 
            icon: <Trash2 size={13} />, 
            variant: "danger", 
            onClick: () => { 
              if (window.confirm("Delete this product?")) deleteProduct.mutate(r.id); 
            } 
          },
        ]} />
      )
    },
  ];

  return (
    <>
      <ListToolbar actionLabel="Product" onAction={openNew}>
        <ExportToolbar resource="products" />
      </ListToolbar>
      <div className="px-4 py-3">
        <DataTable 
          columns={columns} 
          data={data || []} 
          isLoading={isLoading} 
          emptyMessage="No products found" 
          showRank 
          totalLabel="products" 
        />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Product" : "New Product"}>
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
          <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
          <UnitOfMeasureField
            label="Unit of measure"
            labelClassName="label"
            inputClassName="input"
            value={form.unitOfMeasure}
            onChange={(unitOfMeasure) => setForm((f) => ({ ...f, unitOfMeasure }))}
          />
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Sales Price</label><input className="input" type="number" step="0.01" value={form.salesPrice} onChange={e => setForm(f => ({ ...f, salesPrice: e.target.value }))} /></div>
          <div><label className="label">Purchase Price</label><input className="input" type="number" step="0.01" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.trackLotsAndExpiry}
              onChange={e => setForm(f => ({ ...f, trackLotsAndExpiry: e.target.checked }))}
            />
            Enable Lot Tracking + Expiry Date Tracking
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                ...form,
                trackLotsAndExpiry: !!form.trackLotsAndExpiry,
              })
            }
          >
            {save.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </>
  );
}