import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Inventory", href: "/dashboard/stock" },
  { label: "Incoming", href: "/dashboard/stock/incoming" },
  { label: "Outgoing", href: "/dashboard/stock/outgoing" },
  { label: "Batches", href: "/dashboard/stock/batches" },
  { label: "Stock adjustments", href: "/dashboard/stock/adjustments" },
  { label: "Stock transfers", href: "/dashboard/stock/transfers" },
  { label: "Stocktakes", href: "/dashboard/stock/stocktakes" },
];

export default function StockLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
