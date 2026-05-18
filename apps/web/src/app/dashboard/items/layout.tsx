"use client";
import { SubTabs } from "@/components/layout/SubTabs";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Suspense } from "react";

const typeTabs = [
  { label: "Products", href: "/dashboard/items" },
  { label: "Materials", href: "/dashboard/items/materials" },
  { label: "Services", href: "/dashboard/items/services" },
];

function ItemsHeaderInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const isArchive = searchParams.get("archive") === "true";

  return (
    <div className="flex flex-col h-full">
      {/* Row 1: Active | Archive — matches Katana's top tab row */}
      <div className="border-b border-gray-200 bg-white px-5">
        <div className="flex -mb-px gap-1">
          {[
            { label: "Active", archive: false },
            { label: "Archive", archive: true },
          ].map((tab) => (
            <Link
              key={tab.label}
              href={tab.archive ? "?archive=true" : "?"}
              className={clsx(
                "px-3 py-3 text-[13px] border-b-2 transition-colors whitespace-nowrap",
                isArchive === tab.archive
                  ? "border-navy-800 text-gray-900 font-medium"
                  : "border-transparent text-gray-500 font-normal hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {/* Row 2: Products | Materials | Services */}
      <SubTabs tabs={typeTabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex flex-col h-full"><div className="h-10 bg-white border-b" /><div className="h-10 bg-white border-b" /><div className="flex-1" /></div>}>
      <ItemsHeaderInner>{children}</ItemsHeaderInner>
    </Suspense>
  );
}
