"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pencil, Plus } from "lucide-react";

const tabs = [
  { label: "Sales orders", href: "/dashboard/sell" },
  { label: "Quotes", href: "/dashboard/sell/quotes" },
  { label: "Returns", href: "/dashboard/sell/returns" },
  { label: "Price lists", href: "/dashboard/sell/price-lists" },
  { label: "Customers", href: "/dashboard/sell/customers" },
];

const blank = { name: "", email: "", phone: "", address: "", currency: "USD" };

export default function CustomersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.put(`/customers/${d.id}`, d) : api.post("/customers", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving customer", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(c: any) { setForm({ id: c.id, name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", currency: c.currency || "USD" }); setOpen(true); }

  const field = (k: string, label: string, type = "text") => (
    <div key={k}><label className="label">{label}</label><input className="input" type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
  );

  const columns: Column[] = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "code", header: "Code", render: (r) => r.code || "—" },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
    { key: "currency", header: "Currency" },
    { key: "orders", header: "# Orders", render: (r) => r.salesOrders?.length ?? r._count?.salesOrders ?? "—" },
    { key: "actions", header: "", filterable: false, render: (r) => <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil size={14} /></button> },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div />
        <button className="btn-primary text-[13px] py-1.5 px-3 rounded-md inline-flex items-center gap-1.5 font-medium" onClick={openNew}>
          <Plus size={14} strokeWidth={2.5} />Customer
        </button>
      </div>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No customers found" showRank countLabel="customers" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit Customer" : "New Customer"}>
        <div className="space-y-3">
          {field("name", "Name *")}
          {field("email", "Email", "email")}
          {field("phone", "Phone")}
          {field("address", "Address")}
          {field("currency", "Currency")}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
