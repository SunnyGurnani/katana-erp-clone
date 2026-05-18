"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Plus, Trash2 } from "lucide-react";

type Uom = { id: string; name: string };

function unwrap(body: unknown): Uom[] {
  if (Array.isArray((body as { data?: unknown })?.data)) return (body as { data: Uom[] }).data;
  if (Array.isArray(body)) return body as Uom[];
  return [];
}

export default function UnitsOfMeasurePage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [newName, setNewName] = useState("");

  const { data: units, isLoading, isError } = useQuery({
    queryKey: ["units-of-measure"],
    queryFn: () => api.get("/units-of-measure").then((r) => unwrap(r.data)),
    retry: false,
  });

  const create = useMutation({
    mutationFn: (name: string) => api.post("/units-of-measure", { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units-of-measure"] });
      setNewName("");
      addToast("Unit added", "success");
    },
    onError: () => addToast("Could not add unit", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/units-of-measure/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["units-of-measure"] });
      addToast("Unit deleted", "success");
    },
    onError: () => addToast("Could not delete unit", "error"),
  });

  return (
    <div className="px-8 py-6 space-y-6 max-w-2xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Units of measure</h1>
        <p className="text-sm text-gray-500 mt-1">Manage units available when creating products and materials.</p>
      </header>

      {isError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Units API is not available yet. Units can still be entered per item.
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
              {(units || []).map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn text-red-400"
                      aria-label="Delete unit"
                      onClick={() => {
                        if (window.confirm(`Delete unit "${u.name}"?`)) remove.mutate(u.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!units?.length && !isError && (
                <tr>
                  <td colSpan={2} className="text-center text-gray-400 py-6">
                    No units yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="label">Add unit</label>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. bottle"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) create.mutate(newName.trim());
            }}
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
