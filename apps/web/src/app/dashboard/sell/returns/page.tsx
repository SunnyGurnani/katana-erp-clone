"use client";
import { useState, useMemo } from "react";
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
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { customerOptions, salesOrderOptions, productVariantOptions } from "@/lib/catalogOptions";

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
  { key: "variantId", label: "Item (variant)", type: "select", options: [], required: true },
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
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data.data) });

  const custOpts = useMemo(() => customerOptions(customers), [customers]);
  const orderOpts = useMemo(() => salesOrderOptions(orders), [orders]);
  const variantOpts = useMemo(() => productVariantOptions(products), [products]);

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

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data || []) {
      const so = (orders || []).find((o: any) => o.id === r.orderId);
      const cur = (so?.currency || "USD").toUpperCase();
      const total = (r.rows || []).reduce((s: number, row: any) => s + Number(row.qty) * Number(row.unitPrice || 0), 0);
      m.set(cur, (m.get(cur) || 0) + total);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, orders]);

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
      return so ? (
        <a href={`/dashboard/sell/${so.id}`} className="text-brand-600 hover:underline" onClick={e => e.stopPropagation()}>
          {so.soNumber}
        </a>
      ) : "—";
    }},
    { key: "status", header: "Status", isStatus: true, filterable: true, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "total", header: "Total amount", sortable: true, render: (r: any) => {
      const so = (orders || []).find((o: any) => o.id === r.orderId);
      const currency = so?.currency || "USD";
      const total = (r.rows || []).reduce((s: number, row: any) => s + Number(row.qty) * Number(row.unitPrice || 0), 0);
      return <span className="font-medium">{total.toFixed(2)} {currency}</span>;
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
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="text-xs text-gray-500">
            {data?.length || 0} returns
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-700">
              {totalsByCurrency.length <= 1
                ? `Total: ${(totalsByCurrency[0]?.[1] ?? 0).toFixed(2)} ${totalsByCurrency[0]?.[0] ?? "USD"}`
                : `Totals (by currency): ${totalsByCurrency.map(([c, v]) => `${v.toFixed(2)} ${c}`).join(" · ")}`}
            </span>
          </div>
        </div>
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
            selectOptionsByField={{ variantId: variantOpts }}
          />
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Sales Return">
        <div className="space-y-3">
          <div>
            <label className="label">Customer</label>
            <SearchableSelect
              value={customerId}
              onChange={setCustomerId}
              options={custOpts}
              placeholder="Search customers…"
              emptyOptionLabel="— Select —"
              aria-label="Customer"
            />
          </div>
          <div>
            <label className="label">Original sales order</label>
            <SearchableSelect
              value={orderId}
              onChange={setOrderId}
              options={orderOpts}
              placeholder="Search sales orders…"
              emptyOptionLabel="— Select —"
              aria-label="Sales order"
            />
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
