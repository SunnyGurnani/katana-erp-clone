import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Quotes", href: "/dashboard/sell/quotes" },
  { label: "Sales orders", href: "/dashboard/sell" },
  { label: "Returns", href: "/dashboard/sell/returns" },
  { label: "Price lists", href: "/dashboard/sell/price-lists" },
  { label: "Customers", href: "/dashboard/sell/customers" },
];

export default function SellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
