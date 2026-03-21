"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Plus } from "lucide-react";

const tabs = [
  { label: "Sales orders", href: "/dashboard/sell" },
  { label: "Quotes", href: "/dashboard/sell/quotes" },
  { label: "Returns", href: "/dashboard/sell/returns" },
  { label: "Price lists", href: "/dashboard/sell/price-lists" },
  { label: "Customers", href: "/dashboard/sell/customers" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function PriceListsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");

  const { data, isLoading } = useQuery({ queryKey: ["price-lists"], queryFn: () => api.get("/price-lists").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/price-lists", { name, currency }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-lists"] }); addToast("Price list created", "success"); setOpen(false); setName(""); setCurrency("USD"); },
    onError: () => addToast("Error creating price list", "error"),
  });

  const columns: Column[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "currency", header: "Currency" },
    { key: "rows", header: "# of items", render: (r) => r.rows?.length ?? 0 },
    { key: "customers", header: "# of customers", render: (r) => r.customers?.length ?? 0 },
    { key: "isDefault", header: "Default", render: (r) => r.isDefault ? <span className="badge-green">Default</span> : "—" },
    { key: "createdAt", header: "Created", render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div />
        <button className="btn-primary text-[13px] py-1.5 px-3 rounded-md inline-flex items-center gap-1.5 font-medium" onClick={() => setOpen(true)}>
          <Plus size={14} strokeWidth={2.5} />Price list
        </button>
      </div>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No price lists found" showRank countLabel="price lists" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Price List">
        <div className="space-y-3">
          <div><label className="label">Name *</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label className="label">Currency</label><input className="input" value={currency} onChange={e => setCurrency(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={create.isPending || !name} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create"}</button>
        </div>
      </Modal>
    </>
  );
}
