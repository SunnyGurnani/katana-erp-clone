"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { formatLocalDateDisplay } from "@/lib/formatDate";

export default function SalesByOrderPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-orders-insights-list", from, to],
    queryFn: () =>
      api
        .get("/sales-orders", { params: { page: 1, pageSize: 200 } })
        .then((r) => r.data.data || r.data || []),
  });

  const rows = useMemo(() => {
    return (orders || [])
      .map((so: any) => {
        const revenue = (so.rows || []).reduce(
          (s: number, r: any) => s + Number(r.qtyOrdered || 0) * Number(r.unitPrice || 0),
          0,
        );
        const qty = (so.rows || []).reduce((s: number, r: any) => s + Number(r.qtyOrdered || 0), 0);
        return {
          id: so.id,
          soNumber: so.soNumber || so.number,
          customerName: so.customer?.name || "—",
          status: so.status,
          createdAt: so.createdAt,
          revenue,
          qty,
        };
      })
      .filter((r: any) => {
        if (!from && !to) return true;
        const d = new Date(r.createdAt).getTime();
        if (from && d < new Date(from).getTime()) return false;
        if (to && d > new Date(to).getTime() + 86400000) return false;
        return true;
      })
      .sort((a: any, b: any) => b.revenue - a.revenue);
  }, [orders, from, to]);

  const columns: Column[] = [
    {
      key: "soNumber",
      header: "Order",
      render: (r: any) => (
        <Link href={`/dashboard/sell/${r.id}`} className="font-medium text-brand-700 hover:underline">
          {r.soNumber}
        </Link>
      ),
    },
    { key: "customerName", header: "Customer" },
    { key: "status", header: "Status", render: (r: any) => <span className="badge">{r.status}</span> },
    { key: "createdAt", header: "Date", render: (r: any) => formatLocalDateDisplay(r.createdAt) },
    { key: "qty", header: "Qty", render: (r: any) => Number(r.qty).toLocaleString() },
    {
      key: "revenue",
      header: "Total",
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
        emptyMessage="No sales orders in range"
        showRank
        totalLabel="orders"
      />
    </div>
  );
}
