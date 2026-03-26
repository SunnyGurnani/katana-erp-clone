"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect, type SearchableOption } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

export interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
}

export interface ColumnDef {
  key: string;
  header: string;
  render?: (row: any) => React.ReactNode;
}

interface Props {
  title: string;
  parentId: string;
  parentKey: string;
  endpoint: string;
  columns: ColumnDef[];
  formFields: FieldDef[];
  queryKey: string;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
  /** Per-field option lists for searchable selects (e.g. variant picker built from products). */
  selectOptionsByField?: Record<string, SearchableOption[]>;
}

export function ChildTable({ title, parentId, parentKey, endpoint, columns, formFields, queryKey, canEdit = true, canDelete = true, canCreate = true, selectOptionsByField }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, parentId],
    queryFn: () => api.get(endpoint, { params: { [parentKey]: parentId } }).then(r => r.data.data || r.data),
  });

  const create = useMutation({
    mutationFn: (d: any) => api.post(endpoint, { ...d, [parentKey]: parentId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey, parentId] }); addToast("Created", "success"); closeModal(); },
    onError: () => addToast("Error creating", "error"),
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`${endpoint}/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey, parentId] }); addToast("Updated", "success"); closeModal(); },
    onError: () => addToast("Error updating", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey, parentId] }); addToast("Deleted", "success"); },
    onError: () => addToast("Error deleting", "error"),
  });

  function closeModal() { setOpen(false); setEditId(null); setForm({}); }

  function openCreate() {
    setForm({});
    setEditId(null);
    setOpen(true);
  }

  function openEdit(row: any) {
    const f: Record<string, any> = {};
    formFields.forEach(ff => { f[ff.key] = row[ff.key] ?? ""; });
    setForm(f);
    setEditId(row.id);
    setOpen(true);
  }

  function handleDelete(id: string) {
    if (window.confirm("Delete this row?")) remove.mutate(id);
  }

  function handleSave() {
    if (editId) {
      update.mutate({ id: editId, ...form });
    } else {
      create.mutate(form);
    }
  }

  const rows: any[] = Array.isArray(data) ? data : [];

  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        {canCreate && <button className="btn btn-ghost text-sm" onClick={openCreate}><Plus size={14} />Add</button>}
      </div>
      <table className="table">
        <thead>
          <tr>
            {columns.map(c => <th key={c.key}>{c.header}</th>)}
            {(canEdit || canDelete) && <th className="w-20"></th>}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length + 1} className="text-center text-gray-400 py-6">Loading...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length + 1} className="text-center text-gray-400 py-8">No rows yet</td></tr>
          ) : rows.map((row: any) => (
            <tr key={row.id}>
              {columns.map(c => <td key={c.key}>{c.render ? c.render(row) : row[c.key] ?? "—"}</td>)}
              {(canEdit || canDelete) && (
                <td>
                  <div className="flex items-center gap-1">
                    {canEdit && <button className="icon-btn" onClick={() => openEdit(row)}><Pencil size={13} /></button>}
                    {canDelete && <button className="icon-btn text-red-500" onClick={() => handleDelete(row.id)}><Trash2 size={13} /></button>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <Modal open={open} onClose={closeModal} title={editId ? `Edit ${title}` : `Add ${title}`}>
        <div className="space-y-3">
          {formFields.map(f => (
            <div key={f.key}>
              <label className="label">{f.label}{f.required ? " *" : ""}</label>
              {f.type === "select" ? (
                <SearchableSelect
                  value={form[f.key] || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  options={selectOptionsByField?.[f.key] ?? f.options ?? []}
                  placeholder="Search…"
                  emptyOptionLabel="— Select —"
                  aria-label={f.label}
                />
              ) : (
                <input
                  className="input"
                  type={f.type || "text"}
                  step={f.type === "number" ? "any" : undefined}
                  value={form[f.key] || ""}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={handleSave}>
            {create.isPending || update.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
