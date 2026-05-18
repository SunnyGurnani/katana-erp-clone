import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Overview", href: "/dashboard/insights", matchPrefix: true, excludePrefixes: ["/dashboard/insights/sales"] },
  { label: "By product", href: "/dashboard/insights/sales/products" },
  { label: "By customer", href: "/dashboard/insights/sales/customers" },
  { label: "By order", href: "/dashboard/insights/sales/orders" },
];

export default function SalesInsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
