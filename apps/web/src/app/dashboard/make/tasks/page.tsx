"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

function getTaskStatus(op: any): string {
  if (op.status === "completed" || op.status === "done") return "completed";
  if (op.status === "in_progress") return "in_progress";
  if (op.status === "blocked") return "blocked";
  if (op.status === "paused") return "paused";
  return "not_started";
}

const statusOptions = ["not_started", "in_progress", "completed", "blocked", "paused"];

export default function TasksPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["mo-operation-rows"],
    queryFn: () => api.get("/mo-operation-rows").then(r => r.data.data || r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/mo-operation-rows/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mo-operation-rows"] }); addToast("Status updated", "success"); },
    onError: () => addToast("Error updating status", "error"),
  });

  const columns: Column[] = [
    { key: "name", header: "Task", render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "moNumber", header: "MO #", render: (r: any) => <span className="text-brand-600">{r.mo?.moNumber || r.mo?.number || "—"}</span> },
    { key: "product", header: "Product", render: (r: any) => r.mo?.bom?.variant?.product?.name || r.mo?.product?.name || "—" },
    { key: "duration", header: "Duration (min)", render: (r: any) => r.actualMinutes || r.operation?.durationMinutes || "—" },
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => (
      <select
        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
        value={r.status || "not_started"}
        onClick={e => e.stopPropagation()}
        onChange={e => updateStatus.mutate({ id: r.id, status: e.target.value })}
      >
        {statusOptions.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
    )},
  ];

  return (
    <div className="px-4 py-3">
      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        emptyMessage="No tasks found"
        showRank
      />
    </div>
  );
}
