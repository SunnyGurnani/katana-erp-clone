"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Wrench, Package, Boxes, Grid3X3, Calendar, BarChart3, Plus, Bell, HelpCircle, Puzzle, LogOut, Settings } from "lucide-react";
import { logout } from "@/lib/auth";
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
  { label: "Sales order", href: "/dashboard/sell?create=1" },
  { label: "Quote", href: "/dashboard/sell/quotes?create=1" },
  { label: "Purchase order", href: "/dashboard/buy?create=1" },
  { label: "Manufacturing order", href: "/dashboard/make?create=1" },
];

export function TopNav() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="bg-navy-800 text-white flex items-center h-[52px] px-5 shrink-0">
      {/* Left: Logo */}
      <Link href="/dashboard/sell" className="font-bold text-[15px] mr-7 tracking-tight whitespace-nowrap text-white">
        ForgeERP
      </Link>

      {/* Center: Nav items — icons above labels */}
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
        {/* Create button — subtle, white text, no special bg */}
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
