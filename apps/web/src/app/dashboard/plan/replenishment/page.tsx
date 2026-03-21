"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";

export default function ReplenishmentPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["planning-replenishment"],
    queryFn: () => api.get("/planning/replenishment").then(r => r.data),
  });

  const columns: Column[] = [
    { key: "variantSku", header: "SKU", sortable: true, render: (r: any) => <span className="font-mono text-sm">{r.variantSku || "—"}</span> },
    { key: "productName", header: "Product", sortable: true, render: (r: any) => <span className="font-medium">{r.productName}</span> },
    { key: "locationName", header: "Location" },
    { key: "currentStock", header: "Current stock", sortable: true },
    { key: "reorderPoint", header: "Reorder point" },
    { key: "suggestedQty", header: "Suggested qty", sortable: true, render: (r: any) => (
      <span className="font-bold text-brand-600">{r.suggestedQty}</span>
    )},
    { key: "preferredSupplier", header: "Preferred supplier", render: (r: any) => r.preferredSupplier?.supplierName || "—" },
    { key: "urgency", header: "Urgency", isStatus: true, filterable: false, render: (r: any) => {
      if (r.currentStock <= 0) return <StatusCell status="not_available" label="Critical" />;
      return <StatusCell status="expected" label="Low" />;
    }},
  ];

  return (
    <div className="px-4 py-3">
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="All items are adequately stocked" showRank totalLabel="items need restocking" />
    </div>
  );
}
