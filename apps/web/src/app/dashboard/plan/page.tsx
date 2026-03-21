"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";

const tabs = [
  { label: "Forecast", href: "/dashboard/plan" },
  { label: "Replenishment", href: "/dashboard/plan/replenishment" },
];

export default function PlanForecastPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["planning-forecast"],
    queryFn: () => api.get("/planning/forecast").then(r => r.data.data),
  });

  const columns: Column[] = [
    { key: "variantSku", header: "SKU", render: (r) => <span className="font-mono text-[13px]">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", render: (r) => <span className="font-medium">{r.productName || "—"}</span> },
    { key: "locationName", header: "Location" },
    { key: "onHand", header: "On hand", render: (r) => <span className="font-semibold">{r.onHand}</span> },
    { key: "expected", header: "Expected", isStatus: true, render: (r) => <StatusCell status="expected" label={`+${r.expected}`} />, filterable: false },
    { key: "committed", header: "Committed", isStatus: true, render: (r) => <StatusCell status="not_available" label={`-${r.committed}`} />, filterable: false },
    {
      key: "projected", header: "Projected", isStatus: true,
      render: (r) => {
        if (r.projected < 0) return <StatusCell status="not_available" label={String(r.projected)} />;
        if (r.projected === 0) return <StatusCell status="expected" label="0" />;
        return <StatusCell status="in_stock" label={String(r.projected)} />;
      },
      filterable: false,
    },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No inventory data" showRank countLabel="items" />
      </div>
    </>
  );
}
