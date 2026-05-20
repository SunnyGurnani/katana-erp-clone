"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { ChildTable, ColumnDef, FieldDef } from "@/components/shared/ChildTable";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { UnitOfMeasureField } from "@/components/shared/UnitOfMeasureField";

const blank = { name: "", sku: "", description: "", category: "", unitOfMeasure: "pcs", unitCost: "", salePrice: "", reorderPoint: "", trackLotsAndExpiry: false };

const bomCols: ColumnDef[] = [
  { key: "name", header: "BOM Name" },
  { key: "qty", header: "Qty" },
  { key: "notes", header: "Notes" },
];
const bomFields: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "qty", label: "Qty", type: "number" },
  { key: "notes", label: "Notes" },
];

const bomRowCols: ColumnDef[] = [
  { key: "material", header: "Material", render: (r: any) => r.variant?.material?.name || r.variant?.sku || "—" },
  { key: "qty", header: "Qty" },
  { key: "unitCost", header: "Unit Cost", render: (r: any) => `$${Number(r.unitCost || 0).toFixed(2)}` },
];
const bomRowFields: FieldDef[] = [
  { key: "variantId", label: "Variant ID", required: true },
  { key: "qty", label: "Qty", type: "number", required: true },
  { key: "unitCost", label: "Unit Cost", type: "number" },
];

const opCols: ColumnDef[] = [
  { key: "name", header: "Operation" },
  { key: "rank", header: "Step #" },
  { key: "durationMinutes", header: "Duration (min)" },
  { key: "costPerHour", header: "Cost/hr", render: (r: any) => `$${Number(r.costPerHour || 0).toFixed(2)}` },
];
const opFields: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "rank", label: "Step #", type: "number" },
  { key: "durationMinutes", label: "Duration (min)", type: "number" },
  { key: "costPerHour", label: "Cost/hr", type: "number" },
];

export default function ProductsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bomId, setBomId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });
  const { data: boms } = useQuery({
    queryKey: ["product-boms", expanded],
    queryFn: () => api.get("/recipes", { params: { productId: expanded } }).then(r => r.data.data || r.data),
    enabled: !!expanded,
  });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/products/${d.id}`, d) : api.post("/products", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving product", "error"),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting product", "error"),
  });

  const createProductDraft = useMutation({
    mutationFn: () => api.post("/products", { name: "New product", unitOfMeasure: "pcs" }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push(`/dashboard/items/products/${res.data.id}`);
    },
    onError: () => addToast("Error creating product", "error"),
  });

  function openNew() { createProductDraft.mutate(); }
  function openEdit(p: any) {
    setForm({
      id: p.id,
      name: p.name,
      sku: p.variants?.[0]?.sku || "",
      description: p.description || "",
      category: p.category || "",
      unitOfMeasure: p.unitOfMeasure || "pcs",
      unitCost: p.variants?.[0]?.unitCost || "",
      salePrice: p.variants?.[0]?.salePrice || "",
      reorderPoint: p.variants?.[0]?.reorderPoint || "",
      trackLotsAndExpiry: !!p.trackLotsAndExpiry,
    });
    setOpen(true);
  }

  const searchParams = useSearchParams();
  const archive = searchParams.get("archive") === "true";
  const filtered = (data || []).filter((r: any) => {
    const active = (r.status || "active") === "active";
    return archive ? !active : active;
  });

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => (
      <Link className="font-medium text-brand-600 hover:underline text-left" href={`/dashboard/items/products/${r.id}`}>{r.name}</Link>
    )},
    { key: "sku", header: "Variant code / SKU", render: (r: any) => <span className="font-mono text-xs text-gray-700">{r.variants?.map((v: any) => v.sku).filter(Boolean).join(", ") || "—"}</span> },
    { key: "category", header: "Category", render: (r: any) => r.category || "—" },
    { key: "salePrice", header: "Default sales price", render: (r: any) => {
      const price = Number(r.variants?.[0]?.salePrice || 0);
      return price > 0 ? <span>{price.toFixed(2)}</span> : <span className="text-gray-400">0</span>;
    }},
    { key: "cost", header: "Cost", render: (r: any) => {
      const cost = Number(r.variants?.[0]?.unitCost || 0);
      return cost > 0 ? <span>{cost.toFixed(2)}</span> : <span className="text-gray-400">0</span>;
    }},
    { key: "profit", header: "Profit", render: (r: any) => {
      const price = Number(r.variants?.[0]?.salePrice || 0);
      const cost = Number(r.variants?.[0]?.unitCost || 0);
      const profit = price - cost;
      return profit !== 0 ? <span>{profit.toFixed(2)}</span> : <span className="text-gray-400">0</span>;
    }},
    { key: "margin", header: "Margin", render: (r: any) => {
      const price = Number(r.variants?.[0]?.salePrice || 0);
      const cost = Number(r.variants?.[0]?.unitCost || 0);
      if (!price) return <span className="text-gray-400">—</span>;
      return <span>{(((price - cost) / price) * 100).toFixed(1)} %</span>;
    }},
    { key: "productionTime", header: "Prod. time", render: (r: any) => {
      const t = r.productionTime ?? r.leadTime ?? r.variants?.[0]?.productionTime;
      if (!t) return <span className="text-gray-400">—</span>;
      return <span>{t} min</span>;
    }},
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => router.push(`/dashboard/items/products/${r.id}`) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this product?")) deleteProduct.mutate(r.id); } },
      ]} />
    )},
  ];

  // Find first BOM for the expanded product
  const activeBom = bomId || (boms && boms.length > 0 ? boms[0].id : null);

  return (
    <>
      <ListToolbar actionLabel="Product" onAction={openNew}>
        <ExportToolbar resource="products" />
      </ListToolbar>
      <div className="px-4 py-3 space-y-4">
        <DataTable columns={columns} data={filtered} isLoading={isLoading} emptyMessage="No products found" showRank totalLabel="products" />

        {expanded && (
          <>
            <ChildTable
              title="Bills of Materials"
              parentId={expanded}
              parentKey="productId"
              endpoint="/recipes"
              columns={bomCols}
              formFields={bomFields}
              queryKey="product-boms"
            />

            {activeBom && (
              <>
                <ChildTable
                  title="BOM Rows"
                  parentId={activeBom}
                  parentKey="bomId"
                  endpoint="/bom-rows"
                  columns={bomRowCols}
                  formFields={bomRowFields}
                  queryKey="bom-rows"
                />
                <ChildTable
                  title="Product Operations"
                  parentId={activeBom}
                  parentKey="bomId"
                  endpoint="/product-operations"
                  columns={opCols}
                  formFields={opFields}
                  queryKey="product-operations"
                />
              </>
            )}
          </>
        )}
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
          <div><label className="label">Unit Cost</label><input className="input" type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /></div>
          <div><label className="label">Sale Price</label><input className="input" type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} /></div>
          <div><label className="label">Reorder Point</label><input className="input" type="number" value={form.reorderPoint} onChange={e => setForm(f => ({ ...f, reorderPoint: e.target.value }))} /></div>
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
