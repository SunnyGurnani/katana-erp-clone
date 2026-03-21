"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function PriceListsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
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

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "currency", header: "Currency" },
    { key: "rows", header: "# Items", render: (r: any) => r.rows?.length || 0 },
    { key: "customers", header: "# Customers", render: (r: any) => r.customers?.length || 0 },
    { key: "isDefault", header: "Default", isStatus: true, filterable: false, render: (r: any) => r.isDefault ? (
      <div className="status-instock">Default</div>
    ) : <div className="status-cell bg-transparent text-gray-400">—</div> },
  ];

  return (
    <>
      <ListToolbar actionLabel="Price list" onAction={() => setOpen(true)} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No price lists found" showRank totalLabel="price lists" />
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
