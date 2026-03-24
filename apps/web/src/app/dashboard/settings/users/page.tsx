"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { StatusCell } from "@/components/ui/StatusBadge";
import { Pencil, Trash2 } from "lucide-react";

const blank = { email: "", fullName: "", password: "", roleId: "" };

export default function UsersPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...blank, id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then(r => r.data.data || r.data) });
  const { data: roles } = useQuery({ queryKey: ["roles"], queryFn: () => api.get("/users/roles").then(r => r.data.data || r.data).catch(() => []) });

  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/users/${d.id}`, d) : api.post("/users", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); addToast("Saved", "success"); setOpen(false); },
    onError: () => addToast("Error saving user", "error"),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting user", "error"),
  });

  function openNew() { setForm({ ...blank, id: "" }); setOpen(true); }
  function openEdit(u: any) { setForm({ id: u.id, email: u.email, fullName: u.fullName || "", roleId: u.roleId || "", password: "" }); setOpen(true); }

  const columns: Column[] = [
    { key: "fullName", header: "Name", sortable: true, render: (r: any) => <span className="font-medium">{r.fullName || "—"}</span> },
    { key: "email", header: "Email", sortable: true },
    { key: "role", header: "Role", render: (r: any) => <span className="badge">{r.role?.name || "—"}</span> },
    { key: "isActive", header: "Status", isStatus: true, filterable: false, render: (r: any) => <StatusCell status={r.isActive ? "in_stock" : "not_available"} label={r.isActive ? "Active" : "Inactive"} /> },
    { key: "createdAt", header: "Created", render: (r: any) => new Date(r.createdAt).toLocaleDateString() },
    { key: "actions", header: "", filterable: false, render: (r: any) => (
      <ActionMenu actions={[
        { label: "Edit", icon: <Pencil size={13} />, onClick: () => openEdit(r) },
        { label: "Delete", icon: <Trash2 size={13} />, variant: "danger", onClick: () => { if (window.confirm("Delete this user?")) deleteUser.mutate(r.id); } },
      ]} />
    )},
  ];

  return (
    <>
      <ListToolbar actionLabel="User" onAction={openNew} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No users found" showRank totalLabel="users" />
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit User" : "New User"}>
        <div className="space-y-3">
          <div><label className="label">Full Name *</label><input className="input" value={form.fullName} onChange={e => setForm((f: any) => ({ ...f, fullName: e.target.value }))} /></div>
          <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">{form.id ? "New Password (leave blank to keep)" : "Password *"}</label><input className="input" type="password" value={form.password} onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))} /></div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.roleId} onChange={e => setForm((f: any) => ({ ...f, roleId: e.target.value }))}>
              <option value="">— Select role —</option>
              {(roles || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </>
  );
}
