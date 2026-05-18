"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface SubNavItem {
  href: string;
  label: string;
}

interface Props {
  items: SubNavItem[];
}

/**
 * Katana-style section sub-navigation bar.
 * Renders text links with underline-active style below the main nav.
 * Used on: Sell (Quotes | Sales orders | Returns | Price lists | Customers),
 *          Make (Schedule | Tasks), Buy (Purchasing | Outsourcing | Suppliers),
 *          Stock (Inventory | Stock adjustments | Stocktakes), etc.
 */
export function SubNav({ items }: Props) {
  const pathname = usePathname();
  return (
    <div className="bg-white border-b border-gray-200 px-6">
      <div className="flex items-center gap-5 -mb-px">
        {items.map(item => {
          const active = pathname === item.href || 
            (item.href !== "/dashboard/sell" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={clsx(
                "py-2.5 text-[13px] font-medium border-b-2 transition-colors",
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
