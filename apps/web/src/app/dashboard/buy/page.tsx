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
import { Trash2 } from "lucide-react";

const statuses = [
  { label: "Open", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Partial", value: "partial" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", status],
    queryFn: () => api.get("/purchase-orders", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/purchase-orders", { supplierId: supplierId || undefined, expectedAt: expectedAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); addToast("Purchase order created", "success"); setOpen(false); setSupplierId(""); setExpectedAt(""); setNotes(""); },
    onError: () => addToast("Error creating PO", "error"),
  });

  const deletePO = useMutation({
    mutationFn: (id: string) => api.delete(`/purchase-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting PO", "error"),
  });

  const totalCost = (data || []).reduce((s: number, r: any) => s + Number(r.totalCost || 0), 0);

  const columns: Column[] = [
    { key: "createdAt", header: "Created on", sortable: true, render: (r: any) => new Date(r.createdAt).toISOString().slice(0, 10) },
    { key: "poNumber", header: "PO #", sortable: true, render: (r: any) => (
      <Link href={`/dashboard/buy/${r.id}`} className="text-brand-600 font-medium hover:underline" onClick={e => e.stopPropagation()}>
        {r.poNumber}
      </Link>
    )},
    { key: "supplier", header: "Supplier", render: (r: any) => r.supplier?.name || "—" },
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "expectedAt", header: "Expected", sortable: true, render: (r: any) => {
      if (!r.expectedAt) return "—";
      const d = new Date(r.expectedAt);
      const overdue = d < new Date() && !["received", "cancelled"].includes(r.status);
      return <span className={overdue ? "text-red-600 font-medium" : ""}>{d.toISOString().slice(0, 10)}</span>;
    }},
    { key: "totalCost", header: "Total", sortable: true, render: (r: any) => <span className="font-medium">{`${Number(r.totalCost || 0).toFixed(2)} ${r.currency || "USD"}`}</span> },
    { key: "rows", header: "Items", render: (r: any) => <span className="text-gray-500">{r.rows?.length || 0} lines</span> },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this purchase order?")) deletePO.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Purchase order" onAction={() => setOpen(true)}>
        <ExportToolbar resource="purchase-orders" filters={status ? { status } : undefined} />
      </ListToolbar>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{(data || []).length} purchase orders</span>
          <span className="text-xs font-medium text-gray-700">Total: ${totalCost.toFixed(2)}</span>
        </div>
        <DataTable columns={columns} data={data || []} isLoading={isLoading} onRowClick={(row) => router.push(`/dashboard/buy/${row.id}`)} emptyMessage="No purchase orders found" showRank totalLabel="purchase orders" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Purchase Order">
        <div className="space-y-3">
          <div>
            <label className="label">Supplier</label>
            <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">— Select supplier —</option>
              {(suppliers || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Expected Delivery</label><input className="input" type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Add line items after creating the PO.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create PO"}</button>
        </div>
      </Modal>
    </>
  );
}
