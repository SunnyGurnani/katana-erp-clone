"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { DollarSign, ShoppingCart, TrendingUp } from "lucide-react";

export default function SalesInsightsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-sales", from, to],
    queryFn: () => api.get("/insights/sales/summary", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  const { data: byProduct, isLoading: bpLoading } = useQuery({
    queryKey: ["insights-sales-product", from, to],
    queryFn: () => api.get("/insights/sales/by-product", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <label className="label">From</label>
          <input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? <table className="table"><tbody><SkeletonRows rows={3} /></tbody></table> : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#2E7D32]"><DollarSign size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Total Revenue</p><p className="text-xl font-bold">${Number(data.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#1565C0]"><ShoppingCart size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Order Count</p><p className="text-xl font-bold">{data.orderCount}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#7B1FA2]"><TrendingUp size={18} className="text-white" /></div>
              <div><p className="text-xs text-gray-500">Avg Order Value</p><p className="text-xl font-bold">${Number(data.avgOrderValue || 0).toFixed(2)}</p></div>
            </div>
          </div>

          {data.topCustomers?.length > 0 && (
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200"><h2 className="font-semibold text-sm text-gray-800">Top Customers</h2></div>
              <table className="table">
                <thead><tr><th>Customer</th><th>Orders</th></tr></thead>
                <tbody>
                  {data.topCustomers.map((c: any, i: number) => (
                    <tr key={i}><td className="font-medium">{c.customerName || "Unknown"}</td><td>{c.orderCount}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.revenueByMonth?.length > 0 && (
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200"><h2 className="font-semibold text-sm text-gray-800">Revenue by Month</h2></div>
              <table className="table">
                <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.revenueByMonth.map((m: any) => (
                    <tr key={m.month}><td>{m.month}</td><td className="font-semibold">${Number(m.revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!bpLoading && byProduct?.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200"><h2 className="font-semibold text-sm text-gray-800">Sales by Product</h2></div>
          <table className="table">
            <thead><tr><th>Product</th><th>SKU</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {byProduct.map((p: any) => (
                <tr key={p.variantId}>
                  <td className="font-medium">{p.productName || p.variantName || "—"}</td>
                  <td className="font-mono text-xs">{p.variantSku || "—"}</td>
                  <td>{p.totalQty}</td>
                  <td className="font-semibold">${Number(p.totalRevenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
