"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ExportToolbar } from "@/components/shared/ExportToolbar";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { Trash2, ArrowRightCircle } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { customerOptions } from "@/lib/catalogOptions";

const statuses = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

export default function QuotesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", status],
    queryFn: () => api.get("/quotes", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });
  const custOpts = useMemo(() => customerOptions(customers), [customers]);

  const create = useMutation({
    mutationFn: () => api.post("/quotes", { customerId: customerId || undefined, validUntil: validUntil || undefined, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Quote created", "success"); setOpen(false); setCustomerId(""); setValidUntil(""); setNotes(""); },
    onError: () => addToast("Error creating quote", "error"),
  });

  const convert = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert-to-so`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Converted to sales order", "success"); },
    onError: () => addToast("Error converting quote", "error"),
  });

  const deleteQuote = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting quote", "error"),
  });

  const columns: Column[] = [
    { key: "number", header: "Quote #", sortable: true, render: (r: any) => <span className="font-mono text-sm text-brand-600 font-medium">{r.number}</span> },
    { key: "customer", header: "Customer", render: (r: any) => {
      const cust = (customers || []).find((c: any) => c.id === r.customerId);
      return cust?.name || "—";
    }},
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "validUntil", header: "Valid until", sortable: true, render: (r: any) => r.validUntil ? new Date(r.validUntil).toISOString().slice(0, 10) : "—" },
    { key: "total", header: "Amount", render: (r: any) => {
      const total = (r.rows || []).reduce((s: number, row: any) => s + Number(row.qty) * Number(row.unitPrice || 0), 0);
      return <span className="font-medium">{`${total.toFixed(2)} ${r.currency || "USD"}`}</span>;
    }},
    { key: "rows", header: "Items", render: (r: any) => <span className="text-gray-500">{r.rows?.length || 0} lines</span> },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        ...((r.status === "draft" || r.status === "sent") ? [{ label: "Convert to SO", icon: <ArrowRightCircle size={13} />, onClick: () => convert.mutate(r.id) }] : []),
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger" as const, onClick: () => { if (window.confirm("Delete this quote?")) deleteQuote.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Quote" onAction={() => setOpen(true)}>
        <ExportToolbar resource="quotes" filters={status ? { status } : undefined} />
      </ListToolbar>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No quotes found" showRank totalLabel="quotes" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Quote">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <SearchableSelect
              value={customerId}
              onChange={setCustomerId}
              options={custOpts}
              placeholder="Search customers…"
              emptyOptionLabel="— Select customer —"
              aria-label="Customer"
            />
          </div>
          <div><label className="label">Valid Until</label><input className="input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create Quote"}</button>
        </div>
      </Modal>
    </>
  );
}
