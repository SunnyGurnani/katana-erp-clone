"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { DollarSign, ShoppingCart, TrendingUp, Percent } from "lucide-react";
import { InsightsBarChart } from "@/components/insights/InsightsBarChart";

const PRESETS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 12 months", days: 365 },
];

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function SalesOverviewPage() {
  const [preset, setPreset] = useState(90);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const from = customFrom || toIso(new Date(Date.now() - preset * 86400000));
  const to = customTo || toIso(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["insights-sales", from, to],
    queryFn: () => api.get("/insights/sales/summary", { params: { from, to } }).then(r => r.data),
  });

  const { data: byProduct, isLoading: bpLoading } = useQuery({
    queryKey: ["insights-sales-product", from, to],
    queryFn: () => api.get("/insights/sales/by-product", { params: { from, to } }).then(r => r.data),
  });

  return (
    <div className="px-6 py-4 space-y-5">
      {/* Date range filter — Katana-style preset buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
          {PRESETS.map(p => (
            <button
              key={p.days}
              onClick={() => { setPreset(p.days); setCustomFrom(""); setCustomTo(""); }}
              className={`px-3 py-1 rounded text-[13px] font-medium transition-colors ${
                preset === p.days && !customFrom ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input w-36 text-[13px]"
            type="date"
            value={customFrom}
            onChange={e => { setCustomFrom(e.target.value); setPreset(0); }}
            placeholder="From"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            className="input w-36 text-[13px]"
            type="date"
            value={customTo}
            onChange={e => { setCustomTo(e.target.value); setPreset(0); }}
            placeholder="To"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#2E7D32]"><DollarSign size={18} className="text-white" /></div>
              <div>
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-xl font-bold">${Number(data.totalRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-amber-600"><TrendingUp size={18} className="text-white" /></div>
              <div>
                <p className="text-xs text-gray-500">COGS</p>
                <p className="text-xl font-bold">${Number(data.totalCogs || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#1565C0]"><ShoppingCart size={18} className="text-white" /></div>
              <div>
                <p className="text-xs text-gray-500">Profit</p>
                <p className="text-xl font-bold">${Number(data.totalProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className="text-[11px] text-gray-400">{data.orderCount} orders</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="rounded-lg p-2.5 bg-[#7B1FA2]"><Percent size={18} className="text-white" /></div>
              <div>
                <p className="text-xs text-gray-500">Profit margin</p>
                <p className="text-xl font-bold">{Number(data.profitMargin || 0).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          {data.revenueByMonth?.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-sm text-gray-800 mb-3">Revenue by Month</h2>
              <InsightsBarChart
                data={data.revenueByMonth.map((m: any) => ({ label: m.month, value: Number(m.revenue) }))}
                valuePrefix="$"
              />
            </div>
          )}

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
                  <td className="font-medium">{p.productName || p.variantName || "-"}</td>
                  <td className="font-mono text-xs">{p.variantSku || "-"}</td>
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
