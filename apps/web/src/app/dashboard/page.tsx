"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Package, Layers, ShoppingCart, Truck, Wrench, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ElementType; accent?: string }) {
  return (
    <div className={`card p-5 flex items-center gap-4`}>
      <div className={`rounded-xl p-3 ${accent || "bg-brand-50"}`}>
        <Icon size={22} className={accent ? "text-white" : "text-brand-600"} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => api.get("/dashboard/stats").then(r => r.data), staleTime: 30_000 });

  if (isLoading) return <div className="p-6"><SkeletonRows rows={8} /></div>;

  const s = data || {};
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Products" value={s.productCount ?? 0} icon={Package} />
        <StatCard label="Materials" value={s.materialCount ?? 0} icon={Layers} />
        <StatCard label="Open Sales Orders" value={s.openSalesOrders ?? 0} icon={ShoppingCart} accent="bg-green-500" />
        <StatCard label="Open Purchase Orders" value={s.openPurchaseOrders ?? 0} icon={Truck} accent="bg-blue-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Manufacturing Orders" value={s.openMfgOrders ?? 0} icon={Wrench} accent="bg-purple-500" />
        <StatCard label="Low Stock Items" value={s.lowStockCount ?? 0} icon={AlertTriangle} accent={s.lowStockCount > 0 ? "bg-amber-500" : "bg-gray-400"} />
        <StatCard label="Revenue (30d)" value={`$${Number(s.revenue30d ?? 0).toLocaleString()}`} icon={TrendingUp} accent="bg-emerald-500" />
        <StatCard label="PO Spend (30d)" value={`$${Number(s.poSpend30d ?? 0).toLocaleString()}`} icon={DollarSign} />
      </div>

      {s.recentMovements?.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Recent Inventory Movements</h2>
          </div>
          <table className="table">
            <thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>Location</th><th>Date</th></tr></thead>
            <tbody>
              {s.recentMovements.map((m: any) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.variant?.sku || "—"}</td>
                  <td><span className="badge">{m.movementType}</span></td>
                  <td className={m.qty < 0 ? "text-red-600" : "text-green-600"}>{m.qty > 0 ? "+" : ""}{m.qty}</td>
                  <td>{m.location?.name || "—"}</td>
                  <td className="text-gray-500 text-sm">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
