"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { ChildTable, ColumnDef, FieldDef } from "@/components/shared/ChildTable";
import { FileImport } from "@/components/shared/FileImport";
import { Trash2 } from "lucide-react";

const plRowCols: ColumnDef[] = [
  { key: "variantId", header: "Variant", render: (r: any) => r.variant?.sku || r.variantId?.slice(0, 8) || "—" },
  { key: "price", header: "Price", render: (r: any) => `$${Number(r.price || 0).toFixed(2)}` },
  { key: "minQty", header: "Min Qty" },
];
const plRowFields: FieldDef[] = [
  { key: "variantId", label: "Variant ID", required: true },
  { key: "price", label: "Price", type: "number", required: true },
  { key: "minQty", label: "Min Qty", type: "number" },
];

const plCustCols: ColumnDef[] = [
  { key: "customerId", header: "Customer", render: (r: any) => r.customer?.name || r.customerId?.slice(0, 8) || "—" },
];
const plCustFields: FieldDef[] = [
  { key: "customerId", label: "Customer ID", required: true },
];

export default function PriceListsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");

  const { data, isLoading } = useQuery({
    queryKey: ["price-lists"],
    queryFn: () => api.get("/price-lists").then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/price-lists", { name, currency }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-lists"] }); addToast("Price list created", "success"); setOpen(false); setName(""); setCurrency("USD"); },
    onError: () => addToast("Error creating price list", "error"),
  });

  const deletePL = useMutation({
    mutationFn: (id: string) => api.delete(`/price-lists/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-lists"] }); addToast("Deleted", "success"); if (expanded) setExpanded(null); },
    onError: () => addToast("Error deleting price list", "error"),
  });

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => (
      <button className="font-medium text-brand-600 hover:underline" onClick={e => { e.stopPropagation(); setExpanded(expanded === r.id ? null : r.id); }}>{r.name}</button>
    )},
    { key: "currency", header: "Currency" },
    { key: "rows", header: "# Items", render: (r: any) => r.rows?.length || 0 },
    { key: "customers", header: "# Customers", render: (r: any) => r.customers?.length || 0 },
    { key: "isDefault", header: "Default", isStatus: true, filterable: false, render: (r: any) => r.isDefault ? (
      <div className="status-instock">Default</div>
    ) : <div className="status-cell bg-transparent text-gray-400">—</div> },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this price list?")) deletePL.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="Price list" onAction={() => setOpen(true)}>
        <FileImport entity="products" onSuccess={() => qc.invalidateQueries({ queryKey: ["price-lists"] })} />
      </ListToolbar>
      <div className="px-4 py-3 space-y-4">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No price lists found" showRank totalLabel="price lists" />
        {expanded && (
          <>
            <ChildTable
              title="Price List Items"
              parentId={expanded}
              parentKey="priceListId"
              endpoint="/price-list-rows"
              columns={plRowCols}
              formFields={plRowFields}
              queryKey="price-list-rows"
            />
            <ChildTable
              title="Price List Customers"
              parentId={expanded}
              parentKey="priceListId"
              endpoint="/price-list-customers"
              columns={plCustCols}
              formFields={plCustFields}
              queryKey="price-list-customers"
              canEdit={false}
            />
          </>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Price List">
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className="label">Currency</label><input className="input" value={currency} onChange={e => setCurrency(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !name} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create"}</button>
        </div>
      </Modal>
    </>
  );
}
