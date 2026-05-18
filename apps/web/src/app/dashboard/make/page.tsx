"use client";
import { useState, useMemo, useEffect } from "react";
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
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { bomOptions } from "@/lib/catalogOptions";

const statuses = [
  { label: "Open", value: "" },
  { label: "Done", value: "done" },
];

export default function ManufacturingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [bomId, setBomId] = useState("");
  const [qty, setQty] = useState("1");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("newMo") === "1") {
      setOpen(true);
      router.replace("/dashboard/make", { scroll: false });
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["mfg-orders", status],
    queryFn: () => api.get("/manufacturing/orders", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  const { data: boms } = useQuery({ queryKey: ["boms"], queryFn: () => api.get("/manufacturing/boms").then(r => r.data.data) });
  const bomOpts = useMemo(() => bomOptions(boms), [boms]);

  const create = useMutation({
    mutationFn: () => api.post("/manufacturing/orders", { bomId, qty: Number(qty), scheduledAt: scheduledAt || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mfg-orders"] }); addToast("Manufacturing order created", "success"); setOpen(false); setBomId(""); setQty("1"); setScheduledAt(""); },
    onError: () => addToast("Error creating MO", "error"),
  });

  const deleteMO = useMutation({
    mutationFn: (id: string) => api.delete(`/manufacturing/orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mfg-orders"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting MO", "error"),
  });

  const columns: Column[] = [
    { key: "moNumber", header: "MO #", sortable: true, render: (r: any) => (
      <Link href={`/dashboard/make/${r.id}`} className="text-brand-600 font-medium hover:underline" onClick={e => e.stopPropagation()}>
        {r.moNumber}
      </Link>
    )},
    { key: "product", header: "Product", render: (r: any) => r.bom?.variant?.product?.name || r.bom?.name || "—" },
    { key: "customer", header: "Customer", render: (r: any) => r.salesOrder?.customer?.name || r.customer?.name || "—" },
    { key: "qty", header: "Qty", sortable: true },
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "scheduledAt", header: "Scheduled", sortable: true, render: (r: any) => r.scheduledAt ? new Date(r.scheduledAt).toISOString().slice(0, 10) : "—" },
    { key: "completedQty", header: "Completed", render: (r: any) => r.completedQty || 0 },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this MO?")) deleteMO.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Manufacturing order" onAction={() => setOpen(true)}>
        <ExportToolbar resource="boms" />
      </ListToolbar>
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} onRowClick={(row) => router.push(`/dashboard/make/${row.id}`)} emptyMessage="No manufacturing orders found" showRank totalLabel="manufacturing orders" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Manufacturing Order">
        <div className="space-y-3">
          <div>
            <label className="label">Bill of Materials</label>
            <SearchableSelect
              value={bomId}
              onChange={setBomId}
              options={bomOpts}
              placeholder="Search BOMs…"
              emptyOptionLabel="— Select BOM —"
              aria-label="Bill of materials"
            />
          </div>
          <div><label className="label">Qty to Produce</label><input className="input" type="number" value={qty} onChange={e => setQty(e.target.value)} /></div>
          <div><label className="label">Scheduled Date</label><input className="input" type="date" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !bomId} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create MO"}</button>
        </div>
      </Modal>
    </>
  );
}
