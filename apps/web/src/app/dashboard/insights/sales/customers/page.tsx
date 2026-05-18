"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";

export default function SalesByCustomerPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["insights-sales-summary", from, to],
    queryFn: () =>
      api
        .get("/insights/sales/summary", { params: { from: from || undefined, to: to || undefined } })
        .then((r) => r.data),
  });

  const { data: orders } = useQuery({
    queryKey: ["sales-orders-insights", from, to],
    queryFn: () =>
      api
        .get("/sales-orders", { params: { page: 1, pageSize: 200 } })
        .then((r) => r.data.data || r.data || []),
  });

  const rows = useMemo(() => {
    const byCustomer: Record<string, { customerName: string; orderCount: number; revenue: number }> = {};
    for (const c of summary?.topCustomers || []) {
      const name = c.customerName || "Unknown";
      byCustomer[name] = { customerName: name, orderCount: c.orderCount || 0, revenue: 0 };
    }
    for (const so of orders || []) {
      const name = so.customer?.name || "Unknown";
      if (!byCustomer[name]) byCustomer[name] = { customerName: name, orderCount: 0, revenue: 0 };
      byCustomer[name].orderCount += 1;
      const total = (so.rows || []).reduce(
        (s: number, r: any) => s + Number(r.qtyOrdered || 0) * Number(r.unitPrice || 0),
        0,
      );
      byCustomer[name].revenue += total;
    }
    return Object.values(byCustomer).sort((a, b) => b.revenue - a.revenue);
  }, [summary, orders]);

  const columns: Column[] = [
    { key: "customerName", header: "Customer", render: (r: any) => <span className="font-medium">{r.customerName}</span> },
    { key: "orderCount", header: "Orders" },
    {
      key: "revenue",
      header: "Revenue",
      render: (r: any) => (
        <span className="font-semibold">${Number(r.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
        data={rows}
        isLoading={isLoading}
        emptyMessage="No customer sales data"
        showRank
        totalLabel="customers"
      />
    </div>
  );
}
