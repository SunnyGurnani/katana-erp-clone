"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle } from "lucide-react";

export default function ClearDataPage() {
  const { addToast } = useToast();
  const [confirmText, setConfirmText] = useState("");

  const clearDemo = useMutation({
    mutationFn: () => api.delete("/app-settings/demo-data"),
    onSuccess: () => {
      addToast("Demo data cleared", "success");
      setConfirmText("");
    },
    onError: (err: any) => {
      if (err.response?.status === 404) {
        addToast("Clear demo endpoint not configured on this server", "error");
      } else {
        addToast(err.response?.data?.error || "Could not clear demo data", "error");
      }
    },
  });

  const canClear = confirmText === "DELETE";

  return (
    <div className="px-8 py-6 space-y-6 max-w-xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Clear data</h1>
        <p className="text-sm text-gray-500 mt-1">Remove demo or sample data from your account.</p>
      </header>

      <div className="card p-5 border-red-200 bg-red-50/50 space-y-4">
        <div className="flex gap-3">
          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-900">Danger zone</p>
            <p className="text-sm text-red-800 mt-1">
              This permanently deletes demo products, orders, and stock created during onboarding. This cannot be undone.
            </p>
          </div>
        </div>

        <div>
          <label className="label text-red-900">Type DELETE to confirm</label>
          <input
            className="input border-red-200"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
          />
        </div>

        <button
          type="button"
          className="btn bg-red-600 text-white hover:bg-red-700 border-red-600"
          disabled={!canClear || clearDemo.isPending}
          onClick={() => clearDemo.mutate()}
        >
          {clearDemo.isPending ? "Clearing…" : "Clear demo data"}
        </button>
      </div>
    </div>
  );
}
