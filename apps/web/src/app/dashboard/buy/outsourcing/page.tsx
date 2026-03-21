"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ListToolbar } from "@/components/layout/ListToolbar";
import { useState } from "react";

const statuses = [
  { label: "Open", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Received", value: "received" },
];

export default function OutsourcingPage() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["outsourced-po", status],
    queryFn: () => api.get("/outsourced-po-recipe-rows").then(r => r.data.data),
  });

  const columns: Column[] = [
    { key: "poNumber", header: "PO #", render: (r: any) => <span className="text-brand-600 font-medium">{r.po?.number || "—"}</span> },
    { key: "supplier", header: "Supplier", render: (r: any) => r.po?.supplier?.name || "—" },
    { key: "material", header: "Material", render: (r: any) => r.materialId || r.variantId || "—" },
    { key: "qtyRequired", header: "Qty required", sortable: true, render: (r: any) => r.qtyRequired },
    { key: "qtyConsumed", header: "Qty consumed", render: (r: any) => r.qtyConsumed },
    { key: "status", header: "Status", render: (r: any) => <StatusBadge status={r.po?.status || "draft"} /> },
  ];

  return (
    <>
      <ListToolbar
        statusFilter={status}
        onStatusChange={setStatus}
        statuses={statuses}
      />
      <div className="px-4 py-3">
        <DataTable
          columns={columns}
          data={data || []}
          isLoading={isLoading}
          emptyMessage="No outsourced purchase orders"
        />
      </div>
    </>
  );
}
