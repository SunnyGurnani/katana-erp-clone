"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ShoppingCart, Wrench, Package, Boxes, Grid3x3, Calendar, BarChart3, PlusCircle, Bell, Settings, LogOut, HelpCircle, Puzzle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { logout, getMe } from "@/lib/auth";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard/sell", label: "Sell", icon: ShoppingCart },
  { href: "/dashboard/make", label: "Make", icon: Wrench },
  { href: "/dashboard/buy", label: "Buy", icon: Package },
  { href: "/dashboard/stock", label: "Stock", icon: Boxes },
  { href: "/dashboard/plan", label: "Plan", icon: Calendar },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/items", label: "Items", icon: Grid3x3 },
];

const createOptions = [
  { label: "Sales order", href: "/dashboard/sell", action: "so" },
  { label: "Quote", href: "/dashboard/sell/quotes", action: "quote" },
  { label: "Manufacturing order", href: "/dashboard/make", action: "mo" },
  { label: "Purchase order", href: "/dashboard/buy", action: "po" },
];

export function TopNav() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 300_000, retry: false });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <nav className="bg-navy-800 text-white flex items-center h-[52px] px-4 shrink-0 relative z-30">
      {/* Logo */}
      <Link href="/dashboard/sell" className="text-[15px] font-bold mr-6 tracking-tight text-white whitespace-nowrap">
        ForgeERP
      </Link>

      {/* Center nav — icons above labels, evenly spaced */}
      <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-5 py-1 rounded-md text-[10px] font-medium transition-colors min-w-[52px]",
                active ? "bg-navy-700 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon size={18} strokeWidth={1.6} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Mobile nav */}
      <div className="flex md:hidden items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-[10px] font-medium transition-colors shrink-0",
                active ? "bg-navy-700 text-white" : "text-gray-400 hover:text-white"
              )}
            >
              <Icon size={16} strokeWidth={1.6} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1.5 ml-4">
        {/* Create dropdown */}
        <div ref={createRef} className="relative">
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors px-2 py-1.5 rounded-md hover:bg-white/10"
          >
            <PlusCircle size={16} strokeWidth={1.8} />
            <span className="hidden sm:inline text-[13px]">Create</span>
          </button>
          {createOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              {createOptions.map(opt => (
                <Link
                  key={opt.action}
                  href={`${opt.href}?create=${opt.action}`}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setCreateOpen(false)}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Puzzle icon */}
        <button className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/10">
          <Puzzle size={16} strokeWidth={1.6} />
        </button>

        {/* Bell with notification dot */}
        <button className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/10 relative">
          <Bell size={16} strokeWidth={1.6} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Help */}
        <button className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/10">
          <HelpCircle size={16} strokeWidth={1.6} />
        </button>

        {/* User avatar */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="w-7 h-7 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center hover:bg-purple-500 transition-colors ml-1"
          >
            {initials}
          </button>
          {userOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              {user && (
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              )}
              <Link href="/dashboard/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setUserOpen(false)}>
                <Settings size={14} /> Settings
              </Link>
              <button onClick={() => logout()} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
