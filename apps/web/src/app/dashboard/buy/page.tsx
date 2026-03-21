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
  { label: "Purchase orders", href: "/dashboard/buy" },
  { label: "Outsourcing", href: "/dashboard/buy/outsourcing" },
  { label: "Suppliers", href: "/dashboard/buy/suppliers" },
];

const statuses = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Partial", value: "partial" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "po") setOpen(true);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", statusFilter],
    queryFn: () => api.get("/purchase-orders", { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data.data),
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/purchase-orders", { supplierId: supplierId || undefined, expectedAt: expectedAt || undefined, notes: notes || undefined, rows: [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); addToast("Purchase order created", "success"); setOpen(false); setSupplierId(""); setExpectedAt(""); setNotes(""); },
    onError: () => addToast("Error creating PO", "error"),
  });

  const totalAmount = (data || []).reduce((s: number, r: any) => s + Number(r.totalCost || 0), 0);

  const columns: Column[] = [
    { key: "createdAt", header: "Created on", render: (r) => fmtDate(r.createdAt) },
    {
      key: "poNumber", header: "PO #",
      render: (r) => (
        <Link href={`/dashboard/buy/${r.id}`} className="text-brand-600 hover:underline font-medium text-[13px]" onClick={e => e.stopPropagation()}>
          {r.poNumber}
        </Link>
      ),
    },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name || "—" },
    { key: "totalCost", header: "Amount", render: (r) => <span className="font-medium">{Number(r.totalCost || 0).toFixed(2)} USD</span> },
    { key: "expectedAt", header: "Expected", render: (r) => fmtDate(r.expectedAt) },
    { key: "status", header: "Status", isStatus: true, render: (r) => <StatusCell status={r.status} />, filterable: false },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <ListToolbar statusFilter={statusFilter} onStatusFilter={setStatusFilter} statuses={statuses} actionLabel="Purchase order" onAction={() => setOpen(true)} />
      <div className="px-4 py-3">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          rowHref={(r) => `/dashboard/buy/${r.id}`}
          emptyMessage="No purchase orders found"
          showRank
          countLabel="orders"
          totalRow={<span className="font-medium text-gray-700">Total: {totalAmount.toFixed(2)} USD</span>}
        />
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
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create PO"}</button>
        </div>
      </Modal>
    </>
  );
}
