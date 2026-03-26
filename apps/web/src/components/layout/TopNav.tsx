"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Wrench, Package, Boxes, Grid3X3, Calendar, BarChart3, Plus, Bell, HelpCircle, Puzzle, LogOut, Settings, Building2, ChevronDown, Check } from "lucide-react";
import { logout, getTenants, switchTenant, getCurrentTenantId, TenantInfo } from "@/lib/auth";
import clsx from "clsx";
import { useState, useRef, useEffect } from "react";

const navItems = [
  { href: "/dashboard/sell", label: "Sell", icon: ShoppingCart },
  { href: "/dashboard/make", label: "Make", icon: Wrench },
  { href: "/dashboard/buy", label: "Buy", icon: Package },
  { href: "/dashboard/stock", label: "Stock", icon: Boxes },
  { href: "/dashboard/plan", label: "Plan", icon: Calendar },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/items", label: "Items", icon: Grid3X3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const createItems = [
  { label: "Sales order", href: "/dashboard/sell" },
  { label: "Quote", href: "/dashboard/sell/quotes" },
  { label: "Purchase order", href: "/dashboard/buy" },
  { label: "Manufacturing order", href: "/dashboard/make" },
];

export function TopNav() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);

  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(null);

  useEffect(() => {
    setTenants(getTenants());
    setCurrentTenantIdState(getCurrentTenantId());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
      if (tenantRef.current && !tenantRef.current.contains(e.target as Node)) setTenantOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentTenant = tenants.find(t => t.id === currentTenantId) || tenants[0];

  return (
    <nav className="bg-navy-800 text-white flex items-center h-[52px] px-5 shrink-0">
      {/* Left: Logo + Tenant switcher */}
      <div className="flex items-center gap-2 mr-5">
        <Link href="/dashboard/sell" className="font-bold text-[15px] tracking-tight whitespace-nowrap text-white">
          ForgeERP
        </Link>

        {/* Tenant switcher */}
        {tenants.length > 0 && (
          <div className="relative" ref={tenantRef}>
            <button
              onClick={() => setTenantOpen(!tenantOpen)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors max-w-[140px]"
            >
              <Building2 size={12} className="shrink-0 opacity-60" />
              <span className="truncate">{currentTenant?.name || "Select org"}</span>
              <ChevronDown size={10} className="shrink-0 opacity-60" />
            </button>
            {tenantOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Organizations</div>
                {tenants.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTenantOpen(false); if (t.id !== currentTenantId) switchTenant(t.id); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Building2 size={14} className="text-gray-400" />
                    <span className="flex-1 text-left truncate">{t.name}</span>
                    {t.id === currentTenantId && <Check size={14} className="text-green-600" />}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                    onClick={() => setTenantOpen(false)}
                  >
                    <Plus size={14} /> New organization
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Nav items -- icons above labels, Katana-style */}
      <div className="flex items-center gap-1 flex-1 justify-center">
        {navItems.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-3.5 py-1 rounded-md text-[10px] font-medium transition-colors min-w-[50px]",
                active ? "bg-navy-700 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon size={18} strokeWidth={1.6} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Right: Create, icons, user avatar */}
      <div className="flex items-center gap-1.5 ml-4">
        {/* Create button */}
        <div className="relative" ref={createRef}>
          <button
            className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors"
            onClick={() => setCreateOpen(!createOpen)}
          >
            <Plus size={16} strokeWidth={2} className="opacity-80" />
            <span>Create</span>
          </button>
          {createOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] z-50">
              {createItems.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setCreateOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors">
          <Puzzle size={16} />
        </button>

        <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors">
          <HelpCircle size={16} />
        </button>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-[11px] font-bold text-white hover:bg-purple-500 transition-colors ml-1"
          >
            U
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-50">
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setUserOpen(false)}
              >
                <Settings size={14} /> Settings
              </Link>
              <button
                onClick={() => logout()}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
