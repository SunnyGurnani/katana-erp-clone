"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusCell } from "@/components/ui/StatusBadge";
import { AlertTriangle } from "lucide-react";

const tabs = [
  { label: "Inventory", href: "/dashboard/stock" },
  { label: "Batches", href: "/dashboard/stock/batches" },
  { label: "Adjustments", href: "/dashboard/stock/adjustments" },
  { label: "Transfers", href: "/dashboard/stock/transfers" },
  { label: "Stocktakes", href: "/dashboard/stock/stocktakes" },
];

export default function InventoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["inventory-levels"], queryFn: () => api.get("/inventory/levels").then(r => r.data.data) });

  const columns: Column[] = [
    { key: "sku", header: "SKU", render: (r) => <span className="font-mono text-[13px]">{r.variant?.sku || "—"}</span> },
    { key: "item", header: "Item", render: (r) => <span className="font-medium">{r.variant?.product?.name || r.variant?.material?.name || "—"}</span> },
    { key: "location", header: "Location", render: (r) => r.location?.name || "—" },
    { key: "onHand", header: "On hand", render: (r) => <span className="font-semibold">{r.onHand}</span> },
    { key: "reserved", header: "Reserved", render: (r) => r.reserved || 0 },
    {
      key: "available", header: "Available", isStatus: true,
      render: (r) => {
        const avail = (r.onHand || 0) - (r.reserved || 0);
        if (avail > 0) return <StatusCell status="in_stock" label={String(avail)} />;
        if (avail === 0) return <StatusCell status="not_available" label="0" />;
        return <StatusCell status="not_available" label={String(avail)} />;
      },
      filterable: false,
    },
    {
      key: "reorder", header: "Reorder at",
      render: (r) => {
        const avail = (r.onHand || 0) - (r.reserved || 0);
        const low = r.variant?.reorderPoint && avail <= r.variant.reorderPoint;
        return (
          <span className="flex items-center gap-1">
            {r.variant?.reorderPoint || "—"}
            {low && <AlertTriangle size={13} className="text-amber-500" />}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3">
        <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No inventory levels" showRank countLabel="items" />
      </div>
    </>
  );
}
