"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { FileText, ShoppingCart, Package, Wrench } from "lucide-react";

const ICONS: Record<string, typeof FileText> = {
  so: ShoppingCart,
  po: Package,
  mo: Wrench,
  invoice: FileText,
};

type Template = {
  id: string;
  name: string;
  headerText?: string;
  footerText?: string;
};

export default function PrintTemplatesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [edit, setEdit] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", headerText: "", footerText: "" });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["print-templates"],
    queryFn: () => api.get("/app-settings/print-templates").then((r) => r.data as Template[]),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/app-settings/print-templates/${edit!.id}`, {
        name: form.name,
        headerText: form.headerText,
        footerText: form.footerText,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["print-templates"] });
      addToast("Template saved", "success");
      setEdit(null);
    },
    onError: () => addToast("Could not save template", "error"),
  });

  function openEdit(t: Template) {
    setEdit(t);
    setForm({
      name: t.name,
      headerText: t.headerText || "",
      footerText: t.footerText || "",
    });
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Print templates</h1>
        <p className="text-sm text-gray-500 mt-1">Customize header and footer text on PDF documents.</p>
      </header>

      <ul className="space-y-3">
        {(isLoading ? [] : templates || []).map((t) => {
          const Icon = ICONS[t.id] || FileText;
          return (
            <li key={t.id} className="card p-4 flex items-center gap-4">
              <span className="rounded-lg p-2 bg-gray-100 text-gray-600">
                <Icon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{t.name}</p>
                <p className="text-sm text-gray-500 truncate">
                  {[t.headerText, t.footerText].filter(Boolean).join(" · ") || "Default layout"}
                </p>
              </div>
              <button type="button" className="btn btn-ghost text-sm" onClick={() => openEdit(t)}>
                Edit template
              </button>
            </li>
          );
        })}
      </ul>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : "Template"}>
        <div className="space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Header text</label>
            <textarea
              className="input min-h-[72px]"
              value={form.headerText}
              onChange={(e) => setForm((f) => ({ ...f, headerText: e.target.value }))}
              placeholder="Shown at top of PDF"
            />
          </div>
          <div>
            <label className="label">Footer text</label>
            <textarea
              className="input min-h-[72px]"
              value={form.footerText}
              onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
              placeholder="Shown at bottom of PDF"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
