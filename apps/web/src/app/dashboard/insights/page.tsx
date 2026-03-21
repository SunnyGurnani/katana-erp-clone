"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SubTabs } from "@/components/layout/SubTabs";
import { SkeletonRows } from "@/components/ui/Skeleton";

const tabs = [
  { label: "Sales", href: "/dashboard/insights" },
  { label: "Manufacturing", href: "/dashboard/insights/manufacturing" },
  { label: "Purchasing", href: "/dashboard/insights/purchasing" },
];

export default function SalesInsightsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insights-sales", from, to],
    queryFn: () => api.get("/insights/sales/summary", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  const { data: byProduct, isLoading: productLoading } = useQuery({
    queryKey: ["insights-sales-product", from, to],
    queryFn: () => api.get("/insights/sales/by-product", { params: { from: from || undefined, to: to || undefined } }).then(r => r.data),
  });

  return (
    <>
      <SubTabs tabs={tabs} />
      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-900 flex-1">Sales Insights</h2>
          <div className="flex items-center gap-2">
            <input className="input w-36 text-[13px]" type="date" value={from} onChange={e => setFrom(e.target.value)} placeholder="From" />
            <span className="text-gray-400 text-[13px]">to</span>
            <input className="input w-36 text-[13px]" type="date" value={to} onChange={e => setTo(e.target.value)} placeholder="To" />
          </div>
        </div>

        {isLoading ? <div className="card"><table className="table"><tbody><SkeletonRows rows={4} /></tbody></table></div> : data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${Number(data.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Order Count</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.orderCount}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] text-gray-500 font-medium">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${Number(data.avgOrderValue || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Top Customers</h3></div>
                <table className="table">
                  <thead><tr><th>Customer</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {(data.topCustomers || []).map((c: any, i: number) => (
                      <tr key={i}>
                        <td className="font-medium">{c.customerName || "Unknown"}</td>
                        <td>${Number(c.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {!data.topCustomers?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-4">No data</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Revenue by Month</h3></div>
                <table className="table">
                  <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {(data.revenueByMonth || []).map((m: any, i: number) => (
                      <tr key={i}>
                        <td>{m.month}</td>
                        <td className="font-medium">${Number(m.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {!data.revenueByMonth?.length && <tr><td colSpan={2} className="text-center text-gray-400 py-4">No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="card">
          <div className="px-4 py-3 border-b border-gray-200"><h3 className="font-semibold text-[13px] text-gray-800">Sales by Product</h3></div>
          {productLoading ? <table className="table"><tbody><SkeletonRows rows={5} /></tbody></table> : (
            <table className="table">
              <thead><tr><th>Product</th><th>SKU</th><th>Qty sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {(byProduct || []).map((p: any, i: number) => (
                  <tr key={i}>
                    <td className="font-medium">{p.productName || "—"}</td>
                    <td className="font-mono text-[12px]">{p.variantSku || "—"}</td>
                    <td>{p.qtySold}</td>
                    <td className="font-medium">${Number(p.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {!(byProduct || []).length && <tr><td colSpan={4} className="text-center text-gray-400 py-8">No data</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
