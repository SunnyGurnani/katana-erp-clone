"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Wrench, Package, Boxes, Grid3X3, Calendar, BarChart3, Plus, Bell, HelpCircle, Puzzle, LogOut, Settings, Users } from "lucide-react";
import { logout } from "@/lib/auth";
import clsx from "clsx";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

const navItems = [
  { href: "/dashboard/home", label: "Home", icon: Home },
  { href: "/dashboard/sell", label: "Sell", icon: ShoppingCart },
  { href: "/dashboard/make", label: "Make", icon: Wrench },
  { href: "/dashboard/buy", label: "Buy", icon: Package },
  { href: "/dashboard/stock", label: "Stock", icon: Boxes },
  { href: "/dashboard/plan", label: "Plan", icon: Calendar },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
  { href: "/dashboard/items", label: "Items", icon: Grid3X3 },
];

const createItems = [
  { label: "Sales order", href: "/dashboard/sell?newSo=1" },
  { label: "Quote", href: "/dashboard/sell/quotes" },
  { label: "Purchase order", href: "/dashboard/buy?newPo=1" },
  { label: "Manufacturing order", href: "/dashboard/make?newMo=1" },
];

const GAP = 4;
const Z_DROPDOWN = 9999;

export function TopNav() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [createMenuStyle, setCreateMenuStyle] = useState<React.CSSProperties | null>(null);
  const [userMenuStyle, setUserMenuStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!createOpen) {
      setCreateMenuStyle(null);
      return;
    }
    const update = () => {
      const el = createRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mh = createMenuRef.current?.offsetHeight ?? 168;
      let top = rect.bottom + GAP;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - GAP);
      setCreateMenuStyle({
        position: "fixed",
        top,
        right: window.innerWidth - rect.right,
        zIndex: Z_DROPDOWN,
        minWidth: 180,
      });
    };
    update();
    const id = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [createOpen]);

  useLayoutEffect(() => {
    if (!userOpen) {
      setUserMenuStyle(null);
      return;
    }
    const update = () => {
      const el = userRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mh = userMenuRef.current?.offsetHeight ?? 88;
      let top = rect.bottom + GAP;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - GAP);
      setUserMenuStyle({
        position: "fixed",
        top,
        right: window.innerWidth - rect.right,
        zIndex: Z_DROPDOWN,
        minWidth: 160,
      });
    };
    update();
    const id = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [userOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      const inCreate = createRef.current?.contains(t) || createMenuRef.current?.contains(t);
      const inUser = userRef.current?.contains(t) || userMenuRef.current?.contains(t);
      if (!inCreate) setCreateOpen(false);
      if (!inUser) setUserOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="bg-navy-800 text-white flex items-center h-[52px] px-5 shrink-0">
      {/* Left: Logo */}
      <Link href="/dashboard/home" className="font-bold text-[15px] mr-7 tracking-tight whitespace-nowrap text-white">
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
              prefetch={true}
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
          {createOpen &&
            createMenuStyle &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={createMenuRef}
                className="rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                style={createMenuStyle}
              >
                {createItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setCreateOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>,
              document.body
            )}
        </div>

        <Link
          href="/dashboard/account/team"
          className={clsx(
            "p-1.5 rounded-md transition-colors",
            pathname.startsWith("/dashboard/account/team")
              ? "text-white bg-white/10"
              : "text-gray-400 hover:text-white hover:bg-white/10",
          )}
        >
          <Users size={16} />
        </Link>

        <Link
          href="/dashboard/integrations"
          className={clsx(
            "p-1.5 rounded-md transition-colors",
            pathname.startsWith("/dashboard/integrations")
              ? "text-white bg-white/10"
              : "text-gray-400 hover:text-white hover:bg-white/10",
          )}
        >
          <Puzzle size={16} />
        </Link>

        <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10 transition-colors relative">
          <Bell size={16} />
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
          {userOpen &&
            userMenuStyle &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={userMenuRef}
                className="rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                style={userMenuStyle}
              >
                <Link
                  href="/shop-floor"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                  onClick={() => setUserOpen(false)}
                >
                  <Wrench size={14} className="text-brand-600" /> Shop Floor App
                </Link>
                <Link
                  href="/dashboard/account"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setUserOpen(false)}
                >
                  Account settings
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setUserOpen(false)}
                >
                  <Settings size={14} /> Settings
                </Link>
                <button
                  onClick={() => logout()}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>,
              document.body
            )}
        </div>
      </div>
    </nav>
  );
}
