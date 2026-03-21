"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell, StatusBadge } from "@/components/ui/StatusBadge";
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
  { label: "Sent", value: "sent" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function QuotesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "quote") setOpen(true);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: () => api.get("/quotes", { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data.data),
  });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/quotes", { customerId: customerId || undefined, validUntil: validUntil || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Quote created", "success"); setOpen(false); setCustomerId(""); setValidUntil(""); setNotes(""); },
    onError: () => addToast("Error creating quote", "error"),
  });

  const convertToSO = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert-to-so`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Converted to sales order", "success"); setDetailOpen(false); },
    onError: () => addToast("Error converting quote", "error"),
  });

  const deleteQuote = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); addToast("Quote deleted", "success"); setDetailOpen(false); },
    onError: () => addToast("Error deleting quote", "error"),
  });

  const columns: Column[] = [
    { key: "number", header: "Quote #", render: (r) => <span className="font-mono text-[13px] font-medium text-brand-600">{r.number}</span> },
    { key: "customer", header: "Customer", render: (r) => { const c = (customers || []).find((c: any) => c.id === r.customerId); return c?.name || "—"; } },
    { key: "status", header: "Status", isStatus: true, render: (r) => <StatusCell status={r.status} />, filterable: false },
    { key: "validUntil", header: "Valid until", render: (r) => fmtDate(r.validUntil) },
    { key: "totalPrice", header: "Amount", render: (r) => <span className="font-medium">{Number(r.totalPrice || 0).toFixed(2)} USD</span> },
    { key: "createdAt", header: "Created", render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <ListToolbar
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        statuses={statuses}
        actionLabel="Quote"
        onAction={() => setOpen(true)}
      />
      <div className="px-4 py-3">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          onRowClick={(r) => { setSelected(r); setDetailOpen(true); }}
          emptyMessage="No quotes found"
          showRank
          countLabel="quotes"
        />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Quote">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">— Select customer —</option>
              {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Valid Until</label><input className="input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Add line items after creating the quote.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create Quote"}</button>
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Quote ${selected?.number || ""}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Status:</span> <StatusBadge status={selected.status} /></div>
              <div><span className="text-gray-500">Amount:</span> <span className="font-semibold">${Number(selected.totalPrice || 0).toFixed(2)}</span></div>
              <div><span className="text-gray-500">Valid until:</span> {fmtDate(selected.validUntil)}</div>
              <div><span className="text-gray-500">Currency:</span> {selected.currency}</div>
            </div>
            {selected.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.notes}</p>}
            {selected.rows?.length > 0 && (
              <table className="table">
                <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>
                  {selected.rows.map((r: any) => (
                    <tr key={r.id}>
                      <td>{r.description || "—"}</td>
                      <td>{Number(r.qty)}</td>
                      <td>${Number(r.unitPrice || 0).toFixed(2)}</td>
                      <td className="font-medium">${(Number(r.qty) * Number(r.unitPrice || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-end gap-2 pt-2">
              {selected.status === "draft" && (
                <button className="btn btn-danger" onClick={() => deleteQuote.mutate(selected.id)}>Delete</button>
              )}
              {["draft", "sent"].includes(selected.status) && (
                <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={convertToSO.isPending} onClick={() => convertToSO.mutate(selected.id)}>
                  {convertToSO.isPending ? "Converting…" : "Convert to Sales Order"}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
