"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function BatchesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [variantId, setVariantId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: () => api.get("/batches").then(r => r.data.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/batches", { batchNumber, variantId, expiryDate: expiryDate || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches"] }); addToast("Batch created", "success"); setOpen(false); setBatchNumber(""); setVariantId(""); setExpiryDate(""); },
    onError: () => addToast("Error creating batch", "error"),
  });

  const columns: Column[] = [
    { key: "batchNumber", header: "Batch #", sortable: true, render: (r: any) => <span className="font-mono font-medium">{r.batchNumber}</span> },
    { key: "variantId", header: "Variant", render: (r: any) => r.variantId || "—" },
    { key: "expiryDate", header: "Expiry", sortable: true, render: (r: any) => {
      if (!r.expiryDate) return "—";
      const d = new Date(r.expiryDate);
      const expired = d < new Date();
      return <span className={expired ? "text-red-600 font-medium" : ""}>{d.toISOString().slice(0, 10)}</span>;
    }},
    { key: "stockStatus", header: "Status", isStatus: true, filterable: false, render: (r: any) => {
      const total = (r.stocks || []).reduce((s: number, st: any) => s + Number(st.onHand || 0), 0);
      if (total <= 0) return <StatusCell status="not_available" label="Empty" />;
      return <StatusCell status="in_stock" label={`${total} in stock`} />;
    }},
    { key: "createdAt", header: "Created", sortable: true, render: (r: any) => new Date(r.createdAt).toISOString().slice(0, 10) },
  ];

  return (
    <>
      <ListToolbar actionLabel="Batch" onAction={() => setOpen(true)} />
      <div className="px-4 py-3">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          emptyMessage="No batches found"
        />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Batch">
        <div className="space-y-3">
          <div><label className="label">Batch Number</label><input className="input" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="e.g., BATCH-001" /></div>
          <div><label className="label">Variant ID</label><input className="input" value={variantId} onChange={e => setVariantId(e.target.value)} /></div>
          <div><label className="label">Expiry Date</label><input className="input" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || !batchNumber || !variantId} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create"}</button>
        </div>
      </Modal>
    </>
  );
}
