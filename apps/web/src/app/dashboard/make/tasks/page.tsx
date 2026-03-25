"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { Play, Pause, CheckCircle, UserPlus, Clock, User } from "lucide-react";

const statuses = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
];

export default function TasksPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [status, setStatus] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedOperator, setSelectedOperator] = useState("");
  const [actualMinutes, setActualMinutes] = useState("");
  const [taskNotes, setTaskNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["mo-operation-rows", status],
    queryFn: () => api.get("/mo-operation-rows", { params: status ? { status } : {} }).then(r => r.data.data || r.data),
  });

  const { data: operators } = useQuery({
    queryKey: ["operators"],
    queryFn: () => api.get("/users", { params: { isActive: true } }).then(r => r.data.data || []),
  });

  const assignTask = useMutation({
    mutationFn: ({ taskId, assignedToId }: { taskId: string; assignedToId: string }) => 
      api.post(`/mo-operation-rows/${taskId}/assign`, { assignedToId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mo-operation-rows"] });
      addToast("Task assigned", "success");
      setAssignModalOpen(false);
      setSelectedOperator("");
    },
  });

  const startTask = useMutation({
    mutationFn: (taskId: string) => api.post(`/mo-operation-rows/${taskId}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mo-operation-rows"] });
      addToast("Task started", "success");
    },
  });

  const completeTask = useMutation({
    mutationFn: ({ taskId, actualMinutes, notes }: { taskId: string; actualMinutes?: number; notes?: string }) => 
      api.post(`/mo-operation-rows/${taskId}/complete`, { actualMinutes, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mo-operation-rows"] });
      addToast("Task completed", "success");
      setCompleteModalOpen(false);
      setActualMinutes("");
      setTaskNotes("");
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/mo-operation-rows/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mo-operation-rows"] });
      addToast("Status updated", "success");
    },
  });

  function openAssignModal(task: any) {
    setSelectedTask(task);
    setAssignModalOpen(true);
  }

  function openCompleteModal(task: any) {
    setSelectedTask(task);
    setActualMinutes("");
    setTaskNotes(task.notes || "");
    setCompleteModalOpen(true);
  }

  const columns: Column[] = [
    { key: "name", header: "Operation", render: (r: any) => <span className="font-medium">{r.name}</span> },
    { key: "moNumber", header: "MO #", render: (r: any) => (
      <span className="text-brand-600 font-mono text-sm">{r.mo?.number || "—"}</span>
    )},
    { key: "product", header: "Product", render: (r: any) => r.mo?.product?.name || "—" },
    { key: "assignedTo", header: "Assigned To", render: (r: any) => (
      r.assignedTo ? (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400" />
          <span className="text-sm">{r.assignedTo.fullName}</span>
        </div>
      ) : (
        <span className="text-gray-400">Unassigned</span>
      )
    )},
    { key: "duration", header: "Time", render: (r: any) => {
      if (r.actualMinutes) return <span className="font-medium">{r.actualMinutes}m</span>;
      if (r.operation?.durationMinutes) return <span className="text-gray-500">{r.operation.durationMinutes}m (est.)</span>;
      return "—";
    }},
    { key: "status", header: "Status", isStatus: true, filterable: false, render: (r: any) => {
      const statusLabels: Record<string, string> = {
        pending: "Pending",
        assigned: "Assigned", 
        in_progress: "In Progress",
        completed: "Completed",
        blocked: "Blocked",
        paused: "Paused"
      };
      return <StatusCell status={r.status} label={statusLabels[r.status] || r.status} />;
    }},
    { key: "timing", header: "Times", render: (r: any) => (
      <div className="text-xs text-gray-500">
        {r.startedAt && <div>Started: {new Date(r.startedAt).toLocaleTimeString()}</div>}
        {r.completedAt && <div>Done: {new Date(r.completedAt).toLocaleTimeString()}</div>}
      </div>
    )},
    { key: "actions", header: "", filterable: false, render: (r: any) => {
      const actions = [];
      
      if (r.status === "pending") {
        actions.push({ 
          label: "Assign", 
          icon: <UserPlus size={13} />, 
          onClick: () => openAssignModal(r) 
        });
      }
      
      if (r.status === "assigned" || r.status === "paused") {
        actions.push({ 
          label: "Start", 
          icon: <Play size={13} />, 
          onClick: () => startTask.mutate(r.id) 
        });
      }
      
      if (r.status === "in_progress") {
        actions.push({ 
          label: "Complete", 
          icon: <CheckCircle size={13} />, 
          onClick: () => openCompleteModal(r) 
        });
        actions.push({ 
          label: "Pause", 
          icon: <Pause size={13} />, 
          onClick: () => updateStatus.mutate({ id: r.id, status: "paused" }) 
        });
      }

      return <ActionMenu actions={actions} />;
    }},
  ];

  return (
    <>
      <ListToolbar 
        statusFilter={status} 
        onStatusChange={setStatus} 
        statuses={statuses}
      />
      <div className="px-4 py-3">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          emptyMessage="No tasks found"
          showRank
          totalLabel="tasks"
        />
      </div>

      {/* Assign Task Modal */}
      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Task">
        <div className="space-y-3">
          <div>
            <label className="label">Task</label>
            <p className="text-sm text-gray-600">{selectedTask?.name}</p>
          </div>
          <div>
            <label className="label">Manufacturing Order</label>
            <p className="text-sm text-gray-600">{selectedTask?.mo?.number}</p>
          </div>
          <div>
            <label className="label">Assign to Operator</label>
            <select 
              className="input" 
              value={selectedOperator} 
              onChange={e => setSelectedOperator(e.target.value)}
            >
              <option value="">— Select operator —</option>
              {(operators || []).map((op: any) => (
                <option key={op.id} value={op.id}>{op.fullName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setAssignModalOpen(false)}>Cancel</button>
          <button 
            className="btn btn-primary" 
            disabled={!selectedOperator || assignTask.isPending}
            onClick={() => assignTask.mutate({ taskId: selectedTask?.id, assignedToId: selectedOperator })}
          >
            {assignTask.isPending ? "Assigning..." : "Assign Task"}
          </button>
        </div>
      </Modal>

      {/* Complete Task Modal */}
      <Modal open={completeModalOpen} onClose={() => setCompleteModalOpen(false)} title="Complete Task">
        <div className="space-y-3">
          <div>
            <label className="label">Task</label>
            <p className="text-sm text-gray-600">{selectedTask?.name}</p>
          </div>
          <div>
            <label className="label">Manufacturing Order</label>
            <p className="text-sm text-gray-600">{selectedTask?.mo?.number}</p>
          </div>
          <div>
            <label className="label">Actual Time (minutes)</label>
            <input 
              className="input" 
              type="number"
              value={actualMinutes}
              onChange={e => setActualMinutes(e.target.value)}
              placeholder={`Estimated: ${selectedTask?.operation?.durationMinutes || 'N/A'} min`}
            />
          </div>
          <div>
            <label className="label">Completion Notes</label>
            <textarea 
              className="input" 
              rows={3}
              value={taskNotes}
              onChange={e => setTaskNotes(e.target.value)}
              placeholder="Any notes about the completion..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setCompleteModalOpen(false)}>Cancel</button>
          <button 
            className="btn btn-primary" 
            disabled={completeTask.isPending}
            onClick={() => completeTask.mutate({ 
              taskId: selectedTask?.id, 
              actualMinutes: actualMinutes ? Number(actualMinutes) : undefined,
              notes: taskNotes || undefined
            })}
          >
            {completeTask.isPending ? "Completing..." : "Complete Task"}
          </button>
        </div>
      </Modal>
    </>
  );
}
