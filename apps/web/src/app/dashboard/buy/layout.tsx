import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Purchasing", href: "/dashboard/buy" },
  { label: "Outsourcing", href: "/dashboard/buy/outsourcing" },
  { label: "Suppliers", href: "/dashboard/buy/suppliers" },
];

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
