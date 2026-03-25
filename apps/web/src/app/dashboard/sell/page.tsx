"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Trash2 } from "lucide-react";

const statuses = [
  { label: "Open", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Partial", value: "partial" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
];

function getDeliveryStatus(so: any): string {
  if (so.status === "fulfilled") return "delivered";
  if (so.status === "cancelled") return "cancelled";
  if (so.status === "partial") return "packed";
  return "unfulfilled";
}

function getProductionStatus(so: any): string {
  if (so.status === "fulfilled") return "done";
  if (so.status === "cancelled") return "not_applicable";
  if (so.status === "partial") return "wip";
  // Check if any rows have manufacturing requirements
  const hasManufacturedItems = so.rows?.some((row: any) => row.product?.isManufactured);
  if (!hasManufacturedItems) return "not_applicable";
  return "not_started";
}

function getSalesItemsStatus(so: any): string {
  if (so.status === "fulfilled") return "done";
  if (so.status === "cancelled") return "cancelled";
  if (so.status === "partial") return "partial";
  if (!so.rows || so.rows.length === 0) return "not_started";
  return "in_progress";
}

function getIngredientsStatus(so: any): string {
  if (so.status === "fulfilled") return "in_stock";
  if (so.status === "cancelled") return "not_applicable";
  
  // Check ingredient availability for manufactured items
  const manufacturedRows = so.rows?.filter((row: any) => row.product?.isManufactured) || [];
  if (manufacturedRows.length === 0) return "not_applicable";
  
  // For now, assume ingredients are available if SO is not cancelled
  // In a real implementation, this would check actual ingredient inventory
  return "in_stock";
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-orders", status],
    queryFn: () => api.get("/sales-orders", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/sales-orders", { customerId: customerId || undefined, dueAt: dueAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Sales order created", "success"); setOpen(false); setCustomerId(""); setDueAt(""); setNotes(""); },
    onError: () => addToast("Error creating SO", "error"),
  });

  const deleteSO = useMutation({
    mutationFn: (id: string) => api.delete(`/sales-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting SO", "error"),
  });

  const duplicateSO = useMutation({
    mutationFn: (id: string) => api.post(`/sales-orders/${id}/duplicate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); addToast("Duplicated", "success"); },
    onError: () => addToast("Error duplicating SO", "error"),
  });

  const totalAmount = (data || []).reduce((s: number, r: any) => s + Number(r.totalPrice || 0), 0);

  const columns: Column[] = [
    { key: "createdAt", header: "Created on", sortable: true, render: (r: any) => new Date(r.createdAt).toISOString().slice(0, 10) },
    { key: "soNumber", header: "Order #", sortable: true, render: (r: any) => (
      <Link href={`/dashboard/sell/${r.id}`} className="text-brand-600 font-medium hover:underline" onClick={e => e.stopPropagation()}>
        {r.soNumber}
      </Link>
    )},
    { key: "customer", header: "Customer", render: (r: any) => r.customer?.name || "—" },
    { key: "totalPrice", header: "Total amount", sortable: true, render: (r: any) => (
      <span className="font-medium">{`${Number(r.totalPrice || 0).toFixed(2)} ${r.currency || "USD"}`}</span>
    )},
    { key: "dueAt", header: "Delivery deadline", sortable: true, render: (r: any) => {
      if (!r.dueAt) return "—";
      const d = new Date(r.dueAt);
      const overdue = d < new Date() && !["fulfilled", "cancelled"].includes(r.status);
      return <span className={overdue ? "text-red-600 font-medium" : ""}>{d.toISOString().slice(0, 10)}</span>;
    }},
    { key: "salesItems", header: "Sales items", isStatus: true, filterable: false, render: (r: any) => {
      const status = getSalesItemsStatus(r);
      const labels = {
        "done": "Done",
        "cancelled": "Cancelled", 
        "partial": "Partial",
        "in_progress": "In Progress",
        "not_started": "Not Started"
      };
      return <StatusCell status={status} label={labels[status as keyof typeof labels] || status} />;
    }},
    { key: "ingredients", header: "Ingredients", isStatus: true, filterable: false, render: (r: any) => {
      const status = getIngredientsStatus(r);
      const labels = {
        "in_stock": "Available",
        "not_applicable": "N/A",
        "expected": "Expected", 
        "not_available": "Short"
      };
      return <StatusCell status={status} label={labels[status as keyof typeof labels] || status} />;
    }},
    { key: "production", header: "Production", isStatus: true, filterable: false, render: (r: any) => {
      const status = getProductionStatus(r);
      const labels = {
        "done": "Complete",
        "wip": "In Progress",
        "not_started": "Pending",
        "not_applicable": "N/A"
      };
      return <StatusCell status={status} label={labels[status as keyof typeof labels] || status} />;
    }},
    { key: "delivery", header: "Delivery", isStatus: true, filterable: false, render: (r: any) => {
      const status = getDeliveryStatus(r);
      const labels = {
        "delivered": "Delivered",
        "packed": "Packed", 
        "unfulfilled": "Unfulfilled",
        "cancelled": "Cancelled"
      };
      return <StatusCell status={status} label={labels[status as keyof typeof labels] || status} />;
    }},
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Duplicate", icon: <Copy size={13} />, onClick: () => duplicateSO.mutate(r.id) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this sales order?")) deleteSO.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Sales order" onAction={() => setOpen(true)}>
        <ExportToolbar resource="sales-orders" filters={status ? { status } : undefined} />
      </ListToolbar>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{(data || []).length} orders</span>
          <span className="text-xs font-medium text-gray-700">Total: ${totalAmount.toFixed(2)}</span>
        </div>
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/dashboard/sell/${row.id}`)}
          emptyMessage="No sales orders found"
          showRank
          totalLabel="orders"
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
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create SO"}</button>
        </div>
      </Modal>
    </>
  );
}
