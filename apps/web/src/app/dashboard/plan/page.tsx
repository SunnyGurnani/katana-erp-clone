"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { formatQty } from "@/lib/formatQty";
import clsx from "clsx";

export default function PlanningPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"weekly" | "table">("weekly");
  const [includeDemandForecast, setIncludeDemandForecast] = useState(false);

  const { data: planningPrefs } = useQuery({
    queryKey: ["planning-prefs"],
    queryFn: () => api.get("/app-settings/planning").then((r) => r.data),
  });

  useEffect(() => {
    if (planningPrefs?.includeDemandForecast != null) {
      setIncludeDemandForecast(Boolean(planningPrefs.includeDemandForecast));
    }
  }, [planningPrefs]);

  const savePlanningPrefs = useMutation({
    mutationFn: (includeDemandForecast: boolean) =>
      api.patch("/app-settings/planning", { includeDemandForecast }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planning-prefs"] }),
  });

  const { data: weekly, isLoading: weeklyLoading } = useQuery({
    queryKey: ["planning-weekly", includeDemandForecast],
    queryFn: () =>
      api
        .get("/planning/weekly", {
          params: { weeks: 12, includeDemandForecast: includeDemandForecast ? "true" : "false" },
        })
        .then((r) => r.data),
    enabled: view === "weekly",
  });

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ["planning-forecast"],
    queryFn: () => api.get("/planning/forecast").then((r) => r.data),
    enabled: view === "table",
  });

  const columns: Column[] = [
    { key: "variantSku", header: "SKU", sortable: true, render: (r: any) => <span className="font-mono text-sm">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", sortable: true, render: (r: any) => <span className="font-medium">{r.productName}</span> },
    { key: "locationName", header: "Location" },
    { key: "onHand", header: "On hand", sortable: true, render: (r: any) => <span className="font-semibold">{r.onHand}</span> },
    { key: "expected", header: "Expected", render: (r: any) => <span className="text-green-600 font-medium">+{r.expected}</span> },
    { key: "committed", header: "Committed", render: (r: any) => <span className="text-red-600 font-medium">-{r.committed}</span> },
    { key: "projected", header: "Projected", sortable: true, render: (r: any) => (
      <span className={clsx("font-bold", r.projected < 0 ? "text-red-600" : r.projected === 0 ? "text-amber-600" : "text-gray-900")}>
        {r.projected}
      </span>
    )},
    { key: "stockStatus", header: "Status", isStatus: true, filterable: false, render: (r: any) => {
      if (r.projected < 0) return <StatusCell status="not_available" label="Shortage" />;
      if (r.projected === 0) return <StatusCell status="expected" label="At risk" />;
      return <StatusCell status="in_stock" label="OK" />;
    }},
  ];

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={clsx("btn btn-sm", view === "weekly" ? "btn-primary" : "btn-ghost")}
            onClick={() => setView("weekly")}
          >
            Weekly grid
          </button>
          <button
            type="button"
            className={clsx("btn btn-sm", view === "table" ? "btn-primary" : "btn-ghost")}
            onClick={() => setView("table")}
          >
            Forecast table
          </button>
        </div>
        {view === "weekly" && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={includeDemandForecast}
              onChange={(e) => {
                const next = e.target.checked;
                setIncludeDemandForecast(next);
                savePlanningPrefs.mutate(next);
              }}
            />
            Include demand forecast in outgoing
          </label>
        )}
      </div>

      {view === "weekly" && (
        <div className="card overflow-x-auto">
          {weeklyLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading planning grid…</p>
          ) : (
            <table className="table text-sm min-w-[800px]">
              <thead>
                <tr>
                  <th className="text-left sticky left-0 bg-white z-10">Item</th>
                  <th className="text-right">Existing stock</th>
                  {(weekly?.weekLabels || []).map((w: string) => (
                    <th key={w} className="text-right text-xs">{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(weekly?.rows || []).map((row: any) => (
                  <tr key={row.variantId}>
                    <td className="font-medium sticky left-0 bg-white">{row.label}</td>
                    <td className="text-right">{formatQty(row.existingStock, row.unitOfMeasure)}</td>
                    {row.weeks.map((v: number, i: number) => (
                      <td
                        key={i}
                        className={clsx(
                          "text-right",
                          v < 0 && "text-red-600 font-semibold border-b-2 border-red-500",
                        )}
                      >
                        {formatQty(v, row.unitOfMeasure)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {view === "table" && (
        <DataTable
          columns={columns}
          data={forecast || []}
          isLoading={forecastLoading}
          emptyMessage="No inventory data available"
          showRank
          totalLabel="items"
        />
      )}
    </div>
  );
}

