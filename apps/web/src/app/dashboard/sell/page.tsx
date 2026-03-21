"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

const tabs = [
  { label: "Sales orders", href: "/dashboard/sell" },
  { label: "Quotes", href: "/dashboard/sell/quotes" },
  { label: "Returns", href: "/dashboard/sell/returns" },
  { label: "Price lists", href: "/dashboard/sell/price-lists" },
  { label: "Customers", href: "/dashboard/sell/customers" },
];

const statuses = [
  { label: "All", value: "" },
  { label: "Open", value: "draft" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function isOverdue(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d) < new Date();
}

/** Derive a Katana-style status from order data */
function deriveItemsStatus(r: any) {
  if (r.status === "fulfilled" || r.status === "done") return "in_stock";
  if (r.status === "cancelled") return "not_applicable";
  return "not_available";
}

function deriveProductionStatus(r: any) {
  if (r.status === "fulfilled" || r.status === "done") return "done";
  if (r.status === "confirmed") return "make";
  return "not_started";
}

function deriveDeliveryStatus(r: any) {
  if (r.status === "fulfilled" || r.status === "done") return "done";
  if (r.status === "confirmed") return "not_shipped";
  return "not_shipped";
}

export default function SalesOrdersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "so") setOpen(true);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-orders", statusFilter],
    queryFn: () => api.get("/sales-orders", { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data.data),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/sales-orders", { customerId: customerId || undefined, dueAt: dueAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Sales order created", "success"); setOpen(false); setCustomerId(""); setDueAt(""); setNotes(""); },
    onError: () => addToast("Error creating SO", "error"),
  });

  const totalAmount = (data || []).reduce((s: number, r: any) => s + Number(r.totalPrice || 0), 0);

  const columns: Column[] = [
    {
      key: "createdAt", header: "Created on",
      render: (r) => <span className="text-[13px]">{fmtDate(r.createdAt)}</span>,
    },
    {
      key: "soNumber", header: "Order #",
      render: (r) => (
        <Link href={`/dashboard/sell/${r.id}`} className="text-brand-600 hover:underline font-medium text-[13px]" onClick={e => e.stopPropagation()}>
          {r.soNumber}
        </Link>
      ),
    },
    {
      key: "customer", header: "Customer",
      render: (r) => r.customer?.name || "—",
    },
    {
      key: "totalPrice", header: "Total amount",
      render: (r) => <span className="font-medium">{Number(r.totalPrice || 0).toFixed(2)} USD</span>,
    },
    {
      key: "dueAt", header: "Delivery deadline",
      render: (r) => {
        const overdue = r.dueAt && isOverdue(r.dueAt) && !["fulfilled","done","cancelled"].includes(r.status);
        return <span className={overdue ? "text-red-600 font-medium" : ""}>{fmtDate(r.dueAt)}</span>;
      },
    },
    {
      key: "salesItems", header: "Sales items", isStatus: true,
      render: (r) => <StatusCell status={deriveItemsStatus(r)} />,
      filterable: false,
    },
    {
      key: "production", header: "Production", isStatus: true,
      render: (r) => <StatusCell status={deriveProductionStatus(r)} />,
      filterable: false,
    },
    {
      key: "delivery", header: "Delivery", isStatus: true,
      render: (r) => <StatusCell status={deriveDeliveryStatus(r)} />,
      filterable: false,
    },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <ListToolbar
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        statuses={statuses}
        actionLabel="Sales order"
        onAction={() => setOpen(true)}
      />
      <div className="px-4 py-3">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          rowHref={(r) => `/dashboard/sell/${r.id}`}
          emptyMessage="No sales orders found"
          showRank
          countLabel="orders"
          totalRow={<span className="font-medium text-gray-700">Total: {totalAmount.toFixed(2)} USD</span>}
        />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Sales Order">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">— Select customer —</option>
              {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Due Date</label><input className="input" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Add line items after creating the SO.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create SO"}</button>
        </div>
      </Modal>
    </>
  );
}
