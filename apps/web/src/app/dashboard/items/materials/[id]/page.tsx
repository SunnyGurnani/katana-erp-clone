"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { UnitOfMeasureField } from "@/components/shared/UnitOfMeasureField";

const blank = {
  name: "",
  sku: "",
  description: "",
  category: "",
  unitOfMeasure: "pcs",
  purchasePrice: "",
  reorderPoint: "",
  leadTimeDays: "",
  trackLotsAndExpiry: false,
  isActive: true,
};

export default function MaterialDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [form, setForm] = useState(blank);

  const { data: material, isLoading } = useQuery({
    queryKey: ["material", id],
    queryFn: () => api.get(`/materials/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!material) return;
    setForm({
      name: material.name || "",
      sku: material.sku || "",
      description: material.description || "",
      category: material.category || "",
      unitOfMeasure: material.unitOfMeasure || "pcs",
      purchasePrice: material.purchasePrice || "",
      reorderPoint: material.reorderPoint || "",
      leadTimeDays: material.leadTimeDays || "",
      trackLotsAndExpiry: !!material.trackLotsAndExpiry,
      isActive: material.isActive !== false,
    });
  }, [material]);

  const updateMaterial = useMutation({
    mutationFn: () =>
      api.put(`/materials/${id}`, {
        name: form.name.trim() || "Untitled material",
        sku: form.sku.trim() || null,
        description: form.description || null,
        category: form.category || null,
        unitOfMeasure: form.unitOfMeasure || "pcs",
        purchasePrice: form.purchasePrice === "" ? null : Number(form.purchasePrice),
        reorderPoint: form.reorderPoint === "" ? null : Number(form.reorderPoint),
        leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays),
        trackLotsAndExpiry: !!form.trackLotsAndExpiry,
        isActive: !!form.isActive,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["material", id] });
      addToast("Material saved", "success");
    },
    onError: () => addToast("Error saving material", "error"),
  });

  const deleteMaterial = useMutation({
    mutationFn: () => api.delete(`/materials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      router.push("/dashboard/items/materials");
    },
    onError: () => addToast("Error deleting material", "error"),
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading material...</div>;
  if (!material) return <div className="p-6 text-sm text-gray-500">Material not found</div>;

  return (
    <div className="min-h-full bg-white">
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link href="/dashboard/items/materials" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft size={14} /> Materials
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 truncate">{form.name || "Untitled material"}</h1>
          <p className="text-xs text-gray-500 mt-1">{form.sku || "No SKU"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost text-red-600 hover:text-red-700"
            onClick={() => {
              if (window.confirm("Delete this material?")) deleteMaterial.mutate();
            }}
          >
            <Trash2 size={15} /> Delete
          </button>
          <button type="button" className="btn btn-primary" disabled={updateMaterial.isPending} onClick={() => updateMaterial.mutate()}>
            <Save size={15} /> {updateMaterial.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Material details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="klabel">Material name</label>
                <input className="kinput" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="klabel">SKU</label>
                <input className="kinput font-mono" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div>
                <label className="klabel">Category</label>
                <input className="kinput" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <UnitOfMeasureField
                label="Unit of measure"
                labelClassName="klabel"
                inputClassName="kinput"
                value={form.unitOfMeasure}
                onChange={(unitOfMeasure) => setForm((f) => ({ ...f, unitOfMeasure }))}
              />
              <div className="md:col-span-2">
                <label className="klabel">Description</label>
                <textarea
                  className="kinput min-h-[96px]"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <h2 className="text-sm font-semibold text-gray-900 mt-8 mb-4">Purchasing and planning</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="klabel">Default purchase price</label>
                <input className="kinput" type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))} />
              </div>
              <div>
                <label className="klabel">Reorder point</label>
                <input className="kinput" type="number" step="0.01" value={form.reorderPoint} onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))} />
              </div>
              <div>
                <label className="klabel">Lead time days</label>
                <input className="kinput" type="number" value={form.leadTimeDays} onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))} />
              </div>
            </div>
          </section>

          <aside className="border-l border-gray-200 pl-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tracking</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-brand-600"
                checked={form.trackLotsAndExpiry}
                onChange={(e) => setForm((f) => ({ ...f, trackLotsAndExpiry: e.target.checked }))}
              />
              Lots and expiry dates
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 mt-4">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-brand-600"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active material
            </label>
          </aside>
        </div>
      </div>
    </div>
  );
}
