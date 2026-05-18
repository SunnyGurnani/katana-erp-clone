"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";

type SidebarItem = { label: string; href: string };
type SidebarSection = { title?: string; items: SidebarItem[] };

const sidebarSections: SidebarSection[] = [
  {
    title: "General",
    items: [
      { label: "API keys & webhooks", href: "/dashboard/settings" },
      { label: "Account defaults", href: "/dashboard/settings/account-defaults" },
      { label: "Subscription", href: "/dashboard/settings/subscription" },
      { label: "Labs", href: "/dashboard/settings/labs" },
    ],
  },
  {
    title: "Warehouse",
    items: [
      { label: "Warehouse settings", href: "/dashboard/settings/warehouse" },
    ],
  },
  {
    title: "Items",
    items: [
      { label: "Units of measure", href: "/dashboard/settings/units-of-measure" },
      { label: "Categories", href: "/dashboard/settings/categories" },
      { label: "Custom fields", href: "/dashboard/settings/custom-fields" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Costing", href: "/dashboard/settings/costing" },
      { label: "Tax rates", href: "/dashboard/settings/tax-rates" },
      { label: "Currencies", href: "/dashboard/settings/currencies" },
    ],
  },
  {
    title: "Manufacturing",
    items: [
      { label: "Operations", href: "/dashboard/settings/operations" },
      { label: "Factory", href: "/dashboard/settings/factory" },
    ],
  },
  {
    title: "Documents",
    items: [
      { label: "Print templates", href: "/dashboard/settings/print-templates" },
      { label: "Barcodes", href: "/dashboard/settings/barcodes" },
    ],
  },
  {
    title: "Data",
    items: [
      { label: "Assisted import", href: "/dashboard/settings/assisted-import" },
      { label: "Data import", href: "/dashboard/settings/data-import" },
      { label: "Clear data", href: "/dashboard/settings/clear-data" },
    ],
  },
  {
    title: "Access",
    items: [{ label: "Users", href: "/dashboard/settings/users" }],
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full">
      <aside className="w-[260px] shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
        <nav className="py-2">
          {sidebarSections.map((section) => (
            <div key={section.title || "default"}>
              {section.title && (
                <p className="px-6 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center justify-between px-6 py-2.5 text-[13px] transition-colors",
                      active
                        ? "text-brand-700 font-medium bg-brand-50/50 border-r-2 border-brand-600"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                    )}
                  >
                    <span>{item.label}</span>
                    <ChevronRight size={14} className={clsx("text-gray-400", active && "text-brand-600")} />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-y-auto bg-gray-50/30">{children}</div>
    </div>
  );
}
