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

export default function ReplenishmentPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["planning-replenishment"],
    queryFn: () => api.get("/planning/replenishment").then(r => r.data.data),
  });

  const columns: Column[] = [
    { key: "variantSku", header: "SKU", render: (r) => <span className="font-mono text-[13px]">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", render: (r) => <span className="font-medium">{r.productName || "—"}</span> },
    { key: "currentStock", header: "Current stock" },
    { key: "reorderPoint", header: "Reorder point" },
    { key: "suggestedQty", header: "Suggested qty", isStatus: true, render: (r) => <StatusCell status="make" label={String(r.suggestedQty)} />, filterable: false },
    { key: "preferredSupplier", header: "Preferred supplier", render: (r) => r.preferredSupplier?.name || "—" },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="All items are above reorder points" showRank countLabel="suggestions" />
      </div>
    </>
  );
}
