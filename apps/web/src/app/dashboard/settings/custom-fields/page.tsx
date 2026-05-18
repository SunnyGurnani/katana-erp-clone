"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";

const ENTITY_TYPES = [
  { value: "", label: "All entities" },
  { value: "product", label: "Product" },
  { value: "variant", label: "Variant" },
  { value: "material", label: "Material" },
  { value: "supplier", label: "Supplier" },
  { value: "customer", label: "Customer" },
  { value: "purchase_order", label: "Purchase order" },
  { value: "sales_order", label: "Sales order" },
  { value: "manufacturing_order", label: "Manufacturing order" },
];

const FIELD_TYPES = ["text", "number", "boolean", "date", "select", "multiselect", "url"] as const;

function unwrap(body: unknown): any[] {
  if (Array.isArray((body as { data?: unknown })?.data)) return (body as { data: any[] }).data;
  if (Array.isArray(body)) return body;
  return [];
}

const blankForm = {
  id: "",
  entityType: "product",
  name: "",
  label: "",
  fieldType: "text" as (typeof FIELD_TYPES)[number],
  isRequired: false,
  isActive: true,
};

export default function CustomFieldsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [entityType, setEntityType] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);

  const { data, isLoading } = useQuery({
    queryKey: ["custom-fields", entityType],
    queryFn: () =>
      api
        .get("/custom-fields", {
          params: { page: 1, pageSize: 100, ...(entityType ? { entityType } : {}) },
        })
        .then((r) => unwrap(r.data)),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        entityType: form.entityType,
        name: form.name,
        label: form.label,
        fieldType: form.fieldType,
        isRequired: form.isRequired,
        isActive: form.isActive,
      };
      return form.id
        ? api.patch(`/custom-fields/${form.id}`, payload)
        : api.post("/custom-fields", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields"] });
      addToast(form.id ? "Field updated" : "Field created", "success");
      setOpen(false);
    },
    onError: (err: any) => addToast(err.response?.data?.error || "Could not save field", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/custom-fields/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-fields"] });
      addToast("Field deleted", "success");
    },
    onError: () => addToast("Could not delete field", "error"),
  });

  const columns: Column[] = [
    { key: "label", header: "Label", render: (r: any) => <span className="font-medium">{r.label}</span> },
    { key: "name", header: "API name", render: (r: any) => <span className="font-mono text-xs">{r.name}</span> },
    { key: "entityType", header: "Entity", render: (r: any) => <span className="badge">{r.entityType}</span> },
    { key: "fieldType", header: "Type" },
    { key: "isRequired", header: "Required", render: (r: any) => (r.isRequired ? "Yes" : "—") },
    {
      key: "isActive",
      header: "Active",
      render: (r: any) => (
        <span className={`badge ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {r.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r: any) => (
        <div className="flex gap-1 justify-end">
          <button
            type="button"
            className="icon-btn"
            aria-label="Edit"
            onClick={() => {
              setForm({
                id: r.id,
                entityType: r.entityType,
                name: r.name,
                label: r.label,
                fieldType: r.fieldType,
                isRequired: r.isRequired,
                isActive: r.isActive,
              });
              setOpen(true);
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="icon-btn text-red-400"
            aria-label="Delete"
            onClick={() => {
              if (window.confirm(`Delete field "${r.label}"?`)) remove.mutate(r.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="px-8 py-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Custom fields</h1>
          <p className="text-sm text-gray-500 mt-1">Field definitions applied across ForgeERP entities.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary text-sm"
          onClick={() => {
            setForm(blankForm);
            setOpen(true);
          }}
        >
          <Plus size={14} className="mr-1" />
          Add field
        </button>
      </header>

      <div className="flex items-end gap-3">
        <div>
          <label className="label">Entity type</label>
          <select className="input w-52" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {ENTITY_TYPES.map((t) => (
              <option key={t.value || "all"} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <table className="table">
          <tbody>
            <SkeletonRows rows={6} />
          </tbody>
        </table>
      ) : (
        <DataTable columns={columns} data={data || []} emptyMessage="No custom fields defined" totalLabel="fields" />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit custom field" : "New custom field"}>
        <div className="space-y-4">
          <div>
            <label className="label">Entity type</label>
            <select
              className="input"
              value={form.entityType}
              onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}
              disabled={Boolean(form.id)}
            >
              {ENTITY_TYPES.filter((t) => t.value).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Label</label>
            <input className="input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </div>
          <div>
            <label className="label">API name (snake_case)</label>
            <input
              className="input font-mono text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
              disabled={Boolean(form.id)}
            />
          </div>
          <div>
            <label className="label">Field type</label>
            <select
              className="input"
              value={form.fieldType}
              onChange={(e) => setForm((f) => ({ ...f, fieldType: e.target.value as typeof form.fieldType }))}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={save.isPending || !form.label || !form.name}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
