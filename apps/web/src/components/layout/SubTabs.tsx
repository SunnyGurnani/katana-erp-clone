"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface Tab { label: string; href: string; }

export function SubTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-gray-200 bg-white px-4">
      <div className="flex -mb-px">
        {tabs.map(tab => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "border-brand-600 text-gray-900 font-semibold"
                  : "border-transparent text-gray-500 font-normal hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
