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
  { label: "Manufacturing orders", href: "/dashboard/make" },
  { label: "Tasks", href: "/dashboard/make/tasks" },
];

const statuses = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default function ManufacturingPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [bomId, setBomId] = useState("");
  const [qty, setQty] = useState("1");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "mo") setOpen(true);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["mfg-orders", statusFilter],
    queryFn: () => api.get("/manufacturing/orders", { params: statusFilter ? { status: statusFilter } : {} }).then(r => r.data.data),
  });
  const { data: boms } = useQuery({ queryKey: ["boms"], queryFn: () => api.get("/manufacturing/boms").then(r => r.data.data) });

  const create = useMutation({
    mutationFn: () => api.post("/manufacturing/orders", { bomId, qty: Number(qty), scheduledAt: scheduledAt || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mfg-orders"] }); addToast("Manufacturing order created", "success"); setOpen(false); setBomId(""); setQty("1"); setScheduledAt(""); },
    onError: () => addToast("Error creating MO", "error"),
  });

  const columns: Column[] = [
    {
      key: "moNumber", header: "MO #",
      render: (r) => (
        <Link href={`/dashboard/make/${r.id}`} className="text-brand-600 hover:underline font-medium text-[13px]" onClick={e => e.stopPropagation()}>
          {r.moNumber}
        </Link>
      ),
    },
    { key: "product", header: "Product", render: (r) => r.bom?.variant?.product?.name || r.bom?.name || "—" },
    { key: "qty", header: "Qty", render: (r) => r.qty },
    { key: "status", header: "Status", isStatus: true, render: (r) => <StatusCell status={r.status} />, filterable: false },
    { key: "scheduledAt", header: "Scheduled", render: (r) => fmtDate(r.scheduledAt) },
    { key: "createdAt", header: "Created", render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <ListToolbar statusFilter={statusFilter} onStatusFilter={setStatusFilter} statuses={statuses} actionLabel="Manufacturing order" onAction={() => setOpen(true)} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} rowHref={(r) => `/dashboard/make/${r.id}`} emptyMessage="No manufacturing orders found" showRank countLabel="orders" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Manufacturing Order">
        <div className="space-y-3">
          <div>
            <label className="label">Bill of Materials</label>
            <select className="input" value={bomId} onChange={e => setBomId(e.target.value)}>
              <option value="">— Select BOM —</option>
              {(boms || []).map((b: any) => <option key={b.id} value={b.id}>{b.name || b.variant?.product?.name || b.id}</option>)}
            </select>
          </div>
          <div><label className="label">Qty to Produce</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Scheduled Date</label><input className="input" type="date" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary px-4 py-2 rounded-lg text-sm font-medium" disabled={create.isPending || !bomId} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create MO"}</button>
        </div>
      </Modal>
    </>
  );
}
