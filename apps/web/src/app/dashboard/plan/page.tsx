"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";

export default function ForecastPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["planning-forecast"],
    queryFn: () => api.get("/planning/forecast").then(r => r.data),
  });

  const columns: Column[] = [
    { key: "variantSku", header: "SKU", sortable: true, render: (r: any) => <span className="font-mono text-sm">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", sortable: true, render: (r: any) => <span className="font-medium">{r.productName}</span> },
    { key: "locationName", header: "Location" },
    { key: "onHand", header: "On hand", sortable: true, render: (r: any) => <span className="font-semibold">{r.onHand}</span> },
    { key: "expected", header: "Expected", render: (r: any) => <span className="text-green-600 font-medium">+{r.expected}</span> },
    { key: "committed", header: "Committed", render: (r: any) => <span className="text-red-600 font-medium">-{r.committed}</span> },
    { key: "projected", header: "Projected", sortable: true, render: (r: any) => (
      <span className={`font-bold ${r.projected < 0 ? "text-red-600" : r.projected === 0 ? "text-amber-600" : "text-gray-900"}`}>
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
    <div className="px-4 py-3">
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No inventory data available" showRank totalLabel="items" />
    </div>
  );
}
