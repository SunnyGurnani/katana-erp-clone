"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

interface Tab { label: string; href: string; matchPrefix?: boolean; excludePrefixes?: string[]; }

export function SubTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-gray-200 bg-white px-5">
      <div className="flex -mb-px gap-1">
        {tabs.map((tab) => {
          const excluded = tab.excludePrefixes?.some((p) => pathname.startsWith(p));
          const active = tab.matchPrefix
            ? !excluded && (pathname === tab.href || pathname.startsWith(`${tab.href}/`))
            : pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "px-3 py-3 text-[13px] border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "border-navy-800 text-gray-900 font-medium"
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
