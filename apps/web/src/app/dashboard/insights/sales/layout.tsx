import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  {
    label: "Sales Overview",
    href: "/dashboard/insights/sales",
    matchPrefix: true,
    excludePrefixes: ["/dashboard/insights/sales/products", "/dashboard/insights/sales/customers", "/dashboard/insights/sales/orders"],
  },
  { label: "Products", href: "/dashboard/insights/sales/products" },
  { label: "Customers", href: "/dashboard/insights/sales/customers" },
  { label: "Orders", href: "/dashboard/insights/sales/orders" },
];

export default function SalesInsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
