"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Plus, Trash2 } from "lucide-react";

type Category = { id: string; name: string; entityType: "product" | "material"; type?: "product" | "material" };

function unwrap(body: unknown): Category[] {
  if (Array.isArray((body as { data?: unknown })?.data)) return (body as { data: Category[] }).data;
  if (Array.isArray(body)) return body as Category[];
  return [];
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [tab, setTab] = useState<"product" | "material">("product");
  const [newName, setNewName] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["categories", tab],
    queryFn: () =>
      api.get("/categories", { params: { type: tab } }).then((r) => unwrap(r.data)),
    retry: false,
  });

  const create = useMutation({
    mutationFn: (name: string) => api.post("/categories", { name, entityType: tab }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewName("");
      addToast("Category added", "success");
    },
    onError: () => addToast("Could not add category", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      addToast("Category deleted", "success");
    },
    onError: () => addToast("Could not delete category", "error"),
  });

  const filtered = (data || []).filter((c) => (c.entityType || c.type) === tab);

  return (
    <div className="px-8 py-6 space-y-6 max-w-2xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Categories</h1>
        <p className="text-sm text-gray-500 mt-1">Organize products and materials with shared categories.</p>
      </header>

      <div className="flex gap-1 border-b border-gray-200">
        {(["product", "material"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"
            }`}
          >
            {t === "product" ? "Product categories" : "Material categories"}
          </button>
        ))}
      </div>

      {isError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Categories API unavailable — categories can still be set on each item.
        </p>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn text-red-400"
                      onClick={() => {
                        if (window.confirm(`Delete "${c.name}"?`)) remove.mutate(c.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={2} className="text-center text-gray-400 py-6">
                    No categories
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="label">Add category</label>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Finished goods"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          disabled={!newName.trim() || create.isPending}
          onClick={() => create.mutate(newName.trim())}
        >
          <Plus size={14} className="mr-1" />
          Add
        </button>
      </div>
    </div>
  );
}
