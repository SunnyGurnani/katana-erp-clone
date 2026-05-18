"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { formatLocalDateYmd } from "@/lib/formatDate";

export default function CostingPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [closingDate, setClosingDate] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory-closing-date"],
    queryFn: () =>
      api.get("/app-settings/inventory-closing-date").then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    const raw = data?.closingDate ?? data?.inventoryClosingDate ?? data?.date;
    if (raw) setClosingDate(formatLocalDateYmd(raw));
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch("/app-settings/inventory-closing-date", {
        inventoryClosingDate: closingDate || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-closing-date"] });
      addToast("Inventory closing date saved", "success");
    },
    onError: () => addToast("Could not save closing date", "error"),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <SkeletonRows rows={3} />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Costing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set the inventory closing date for cost calculations and period-end valuation.
        </p>
      </header>

      {isError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          App settings API not available. Configure closing date when the endpoint is enabled.
        </p>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Inventory closing date</label>
          <input
            type="date"
            className="input"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Stock movements before this date are included in closed-period costing.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
