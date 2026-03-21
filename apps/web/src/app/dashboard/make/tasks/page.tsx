"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";

function getTaskStatus(op: any): string {
  if (op.status === "completed" || op.status === "done") return "completed";
  if (op.status === "in_progress") return "in_progress";
  if (op.status === "blocked") return "blocked";
  if (op.status === "paused") return "paused";
  return "not_started";
}

export default function TasksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["mo-operations"],
    queryFn: () => api.get("/manufacturing/operation-rows").then(r => r.data.data),
  });

  const columns: Column[] = [
    { key: "name", header: "Task", render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "moNumber", header: "MO #", render: (r: any) => <span className="text-brand-600">{r.mo?.number || "—"}</span> },
    { key: "product", header: "Product", render: (r: any) => r.mo?.product?.name || "—" },
    { key: "duration", header: "Duration (min)", render: (r: any) => r.actualMinutes || r.operation?.durationMinutes || "—" },
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={getTaskStatus(r)} /> },
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
