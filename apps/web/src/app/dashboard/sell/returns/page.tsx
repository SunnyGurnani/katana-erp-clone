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
import { ChildTable, ColumnDef, FieldDef } from "@/components/shared/ChildTable";
import { Trash2, CheckCircle } from "lucide-react";

const statuses = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const returnRowCols: ColumnDef[] = [
  { key: "variant", header: "SKU", render: (r: any) => r.variant?.sku || "—" },
  { key: "qty", header: "Qty" },
  { key: "unitPrice", header: "Unit Price", render: (r: any) => `$${Number(r.unitPrice || 0).toFixed(2)}` },
  { key: "returnReason", header: "Reason" },
];

const returnRowFields: FieldDef[] = [
  { key: "variantId", label: "Variant ID", required: true },
  { key: "qty", label: "Qty", type: "number", required: true },
  { key: "unitPrice", label: "Unit Price", type: "number" },
  { key: "returnReason", label: "Reason" },
];

export default function ReturnsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sales-returns", status],
    queryFn: () => api.get("/sales-returns", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });
  const { data: orders } = useQuery({ queryKey: ["sales-orders"], queryFn: () => api.get("/sales-orders").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/sales-returns", { customerId: customerId || undefined, orderId: orderId || undefined, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-returns"] }); addToast("Return created", "success"); setOpen(false); setCustomerId(""); setOrderId(""); setNotes(""); },
    onError: () => addToast("Error creating return", "error"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.post(`/sales-returns/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-returns"] }); addToast("Return completed", "success"); },
    onError: () => addToast("Error completing return", "error"),
  });

  const deleteReturn = useMutation({
    mutationFn: (id: string) => api.delete(`/sales-returns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-returns"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting return", "error"),
  });

  const columns: Column[] = [
    { key: "createdAt", header: "Created on", sortable: true, render: (r: any) => new Date(r.createdAt).toISOString().slice(0, 10) },
    { key: "number", header: "Return #", sortable: true, render: (r: any) => (
      <button className="font-mono text-sm text-brand-600 font-medium hover:underline" onClick={e => { e.stopPropagation(); setExpanded(expanded === r.id ? null : r.id); }}>
        {r.number}
      </button>
    )},
    { key: "customer", header: "Customer", render: (r: any) => {
      const cust = (customers || []).find((c: any) => c.id === r.customerId);
      return cust?.name || "—";
    }},
    { key: "orderId", header: "Original SO", render: (r: any) => {
      const so = (orders || []).find((o: any) => o.id === r.orderId);
      return so?.soNumber || "—";
    }},
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "total", header: "Total", render: (r: any) => {
      const total = (r.rows || []).reduce((s: number, row: any) => s + Number(row.qty) * Number(row.unitPrice || 0), 0);
      return <span className="font-medium">${total.toFixed(2)}</span>;
    }},
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        ...(r.status === "draft" ? [{ label: "Complete", icon: <CheckCircle size={13} />, onClick: () => complete.mutate(r.id) }] : []),
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger" as const, onClick: () => { if (window.confirm("Delete this return?")) deleteReturn.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Return" onAction={() => setOpen(true)} />
      <div className="px-4 py-3 space-y-4">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No returns found" showRank totalLabel="returns" />
        {expanded && (
          <ChildTable
            title="Return Rows"
            parentId={expanded}
            parentKey="returnId"
            endpoint="/sales-return-rows"
            columns={returnRowCols}
            formFields={returnRowFields}
            queryKey="sales-return-rows"
          />
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Sales Return">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">— Select —</option>
              {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Original Sales Order</label>
            <select className="input" value={orderId} onChange={e => setOrderId(e.target.value)}>
              <option value="">— Select —</option>
              {(orders || []).map((o: any) => <option key={o.id} value={o.id}>{o.soNumber}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create Return"}</button>
        </div>
      </Modal>
    </>
  );
}
