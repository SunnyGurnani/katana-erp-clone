"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Package, Layers, MapPin, Boxes, Users, Truck, ShoppingCart, Wrench, ArrowLeftRight, ClipboardList, Settings, LogOut, Menu, X, AlertTriangle } from "lucide-react";
import { logout } from "@/lib/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { section: "Catalog" },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/materials", label: "Materials", icon: Layers },
  { href: "/dashboard/locations", label: "Locations", icon: MapPin },
  { section: "Orders" },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: Truck },
  { href: "/dashboard/sales-orders", label: "Sales Orders", icon: ShoppingCart },
  { href: "/dashboard/manufacturing", label: "Manufacturing", icon: Wrench },
  { section: "People" },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Users },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { section: "Warehouse" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/stock-adjustments", label: "Adjustments", icon: ClipboardList },
  { href: "/dashboard/stock-transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/dashboard/stocktakes", label: "Stocktakes", icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => api.get("/dashboard/stats").then(r => r.data), staleTime: 60_000 });
  const lowStock = stats?.lowStockCount ?? 0;

  const content = (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-5 border-b border-gray-200">
        <span className="text-lg font-bold text-brand-700">ForgeERP</span>
        <button className="md:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {nav.map((item, i) => {
          if ("section" in item) return <p key={i} className="mt-4 mb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{item.section}</p>;
          const { href, label, icon: Icon } = item as { href: string; label: string; icon: React.ElementType };
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5", active ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100")}>
              <Icon size={15} />{label}
            </Link>
          );
        })}
        {lowStock > 0 && (
          <Link href="/dashboard/inventory" className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100">
            <AlertTriangle size={14} /> {lowStock} low stock item{lowStock > 1 ? "s" : ""}
          </Link>
        )}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <Link href="/dashboard/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
          <Settings size={15} />Settings
        </Link>
        <button onClick={() => logout()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
          <LogOut size={15} />Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex h-screen">{content}</div>
      {/* Mobile toggle */}
      <button className="md:hidden fixed top-4 left-4 z-50 card p-2" onClick={() => setOpen(true)}><Menu size={18} /></button>
      {open && <div className="md:hidden fixed inset-0 z-40 flex"><div className="flex h-full">{content}</div><div className="flex-1 bg-black/40" onClick={() => setOpen(false)} /></div>}
    </>
  );
}
