"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";

export default function SalesByProductPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-sales-product", from, to],
    queryFn: () =>
      api
        .get("/insights/sales/by-product", { params: { from: from || undefined, to: to || undefined } })
        .then((r) => r.data),
  });

  const columns: Column[] = [
    { key: "productName", header: "Product", render: (r: any) => <span className="font-medium">{r.productName || r.variantName || "—"}</span> },
    { key: "variantSku", header: "SKU", render: (r: any) => <span className="font-mono text-xs">{r.variantSku || "—"}</span> },
    { key: "totalQty", header: "Qty sold", render: (r: any) => Number(r.totalQty || 0).toLocaleString() },
    {
      key: "totalRevenue",
      header: "Revenue",
      render: (r: any) => (
        <span className="font-semibold">${Number(r.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      ),
    },
  ];

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <label className="label">From</label>
          <input className="input w-36" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input w-36" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data || []}
        isLoading={isLoading}
        emptyMessage="No product sales in range"
        showRank
        totalLabel="products"
      />
    </div>
  );
}
