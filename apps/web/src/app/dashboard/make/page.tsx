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
import { Trash2, GripVertical, Move } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const statuses = [
  { label: "All", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Released", value: "released" },
  { label: "In progress", value: "in_progress" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" },
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
  const [dragEnabled, setDragEnabled] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["mfg-orders", status],
    queryFn: () => api.get("/manufacturing/orders", { params: status ? { status } : {} }).then(r => r.data.data),
  });
  const { data: boms } = useQuery({ queryKey: ["boms"], queryFn: () => api.get("/manufacturing/boms").then(r => r.data.data) });

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

  const reorderMOs = useMutation({
    mutationFn: (orderedIds: string[]) => api.post("/manufacturing/orders/rerank", { orderedIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mfg-orders"] });
      addToast("Order priority updated", "success");
    },
    onError: () => addToast("Error updating order priority", "error"),
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination || !data) return;

    const items = Array.from(data);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update the order in the UI immediately
    qc.setQueryData(["mfg-orders", status], items);
    
    // Send the new order to the backend
    const orderedIds = items.map((item: any) => item.id);
    reorderMOs.mutate(orderedIds);
  };

  const columns: Column[] = [
    ...(dragEnabled ? [{
      key: "drag", 
      header: "", 
      render: () => (
        <div className="drag-handle cursor-move text-gray-400 hover:text-gray-600">
          <GripVertical size={16} />
        </div>
      )
    }] : []),
    { key: "priority", header: "#", render: (r: any, index: number) => (
      <span className="text-xs text-gray-500 font-medium">{(index || 0) + 1}</span>
    )},
    { key: "moNumber", header: "MO #", sortable: true, render: (r: any) => (
      <Link href={`/dashboard/make/${r.id}`} className="text-brand-600 font-medium hover:underline" onClick={e => e.stopPropagation()}>
        {r.moNumber}
      </Link>
    )},
    { key: "product", header: "Product", render: (r: any) => (
      <div>
        <div className="font-medium">{r.product?.name || r.bom?.name || "—"}</div>
        {r.bom?.name && r.product?.name !== r.bom?.name && (
          <div className="text-xs text-gray-500">BOM: {r.bom.name}</div>
        )}
      </div>
    )},
    { key: "qty", header: "Qty", sortable: true, render: (r: any) => (
      <div>
        <div className="font-medium">{r.qty}</div>
        {r.completedQty > 0 && (
          <div className="text-xs text-gray-500">{r.completedQty} produced</div>
        )}
      </div>
    )},
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={r.status} /> },
    { key: "scheduledAt", header: "Scheduled", sortable: true, render: (r: any) => r.scheduledAt ? new Date(r.scheduledAt).toISOString().slice(0, 10) : "—" },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this MO?")) deleteMO.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar statusFilter={status} onStatusChange={setStatus} statuses={statuses} actionLabel="Manufacturing order" onAction={() => setOpen(true)}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDragEnabled(!dragEnabled)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              dragEnabled 
                ? "bg-brand-600 text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Move size={14} />
            {dragEnabled ? "Exit Reorder" : "Reorder Priority"}
          </button>
          <ExportToolbar resource="manufacturing-orders" />
        </div>
      </ListToolbar>
      
      <div className="px-4 py-3">
        {dragEnabled && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Drag & Drop Mode:</strong> Drag manufacturing orders to reorder their priority. Higher priority orders appear first in the schedule.
            </p>
          </div>
        )}

        {dragEnabled && data ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="manufacturing-orders">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  <div className="bg-white rounded-lg border overflow-hidden">
                    <table className="table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>#</th>
                          <th>MO #</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Status</th>
                          <th>Scheduled</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((mo: any, index: number) => (
                          <Draggable key={mo.id} draggableId={mo.id} index={index}>
                            {(provided) => (
                              <tr
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="hover:bg-gray-50"
                              >
                                <td {...provided.dragHandleProps}>
                                  <GripVertical size={16} className="text-gray-400 cursor-move" />
                                </td>
                                <td className="text-xs text-gray-500 font-medium">{index + 1}</td>
                                <td>
                                  <Link 
                                    href={`/dashboard/make/${mo.id}`} 
                                    className="text-brand-600 font-medium hover:underline"
                                  >
                                    {mo.moNumber}
                                  </Link>
                                </td>
                                <td>
                                  <div>
                                    <div className="font-medium">{mo.product?.name || mo.bom?.name || "—"}</div>
                                    {mo.bom?.name && mo.product?.name !== mo.bom?.name && (
                                      <div className="text-xs text-gray-500">BOM: {mo.bom.name}</div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <div className="font-medium">{mo.qty}</div>
                                    {mo.completedQty > 0 && (
                                      <div className="text-xs text-gray-500">{mo.completedQty} produced</div>
                                    )}
                                  </div>
                                </td>
                                <td><StatusCell status={mo.status} /></td>
                                <td>{mo.scheduledAt ? new Date(mo.scheduledAt).toISOString().slice(0, 10) : "—"}</td>
                                <td>
                                  <ActionMenu actions={[
                                    { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this MO?")) deleteMO.mutate(mo.id); } },
                                  ]} />
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        ))}
                      </tbody>
                    </table>
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <DataTable 
            columns={columns} 
            data={data || []} 
            isLoading={isLoading} 
            onRowClick={(row) => router.push(`/dashboard/make/${row.id}`)} 
            emptyMessage="No manufacturing orders found" 
            showRank 
            totalLabel="manufacturing orders" 
          />
        )}
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
          <button className="btn btn-primary" disabled={create.isPending || !bomId} onClick={() => create.mutate()}>{create.isPending ? "Creating..." : "Create MO"}</button>
        </div>
      </Modal>
    </>
  );
}
