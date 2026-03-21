"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const tabs = [
  { label: "Sales orders", href: "/dashboard/sell" },
  { label: "Quotes", href: "/dashboard/sell/quotes" },
  { label: "Returns", href: "/dashboard/sell/returns" },
  { label: "Price lists", href: "/dashboard/sell/price-lists" },
  { label: "Customers", href: "/dashboard/sell/customers" },
];

const statuses = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function ReturnsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-returns", statusFilter],
    queryFn: () => api.get("/sales-returns", { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data.data),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });
  const { data: salesOrders } = useQuery({ queryKey: ["sales-orders"], queryFn: () => api.get("/sales-orders").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/sales-returns", { orderId: orderId || undefined, customerId: customerId || undefined, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-returns"] }); addToast("Return created", "success"); setOpen(false); setOrderId(""); setCustomerId(""); setNotes(""); },
    onError: () => addToast("Error creating return", "error"),
  });

  const columns: Column[] = [
    { key: "number", header: "Return #", render: (r) => <span className="font-mono text-[13px] font-medium text-brand-600">{r.number}</span> },
    { key: "customer", header: "Customer", render: (r) => { const c = (customers || []).find((c: any) => c.id === r.customerId); return c?.name || "—"; } },
    { key: "orderId", header: "Original SO", render: (r) => { const so = (salesOrders || []).find((s: any) => s.id === r.orderId); return so?.soNumber || "—"; } },
    { key: "status", header: "Status", isStatus: true, render: (r) => <StatusCell status={r.status} />, filterable: false },
    { key: "total", header: "Total", render: (r) => { const total = (r.rows || []).reduce((s: number, row: any) => s + Number(row.qty) * Number(row.unitPrice || 0), 0); return <span className="font-medium">{total.toFixed(2)} USD</span>; } },
    { key: "createdAt", header: "Created", render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <ListToolbar statusFilter={statusFilter} onStatusFilter={setStatusFilter} statuses={statuses} actionLabel="Return" onAction={() => setOpen(true)} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No returns found" showRank countLabel="returns" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Sales Return">
        <div className="space-y-3">
          <div>
            <label className="label">Original Sales Order</label>
            <select className="input" value={orderId} onChange={e => setOrderId(e.target.value)}>
              <option value="">— Select SO —</option>
              {(salesOrders || []).map((so: any) => <option key={so.id} value={so.id}>{so.soNumber} - {so.customer?.name || "N/A"}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">— Select customer —</option>
              {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create Return"}</button>
        </div>
      </Modal>
    </>
  );
}
