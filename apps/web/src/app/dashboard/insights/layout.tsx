import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Sales", href: "/dashboard/insights" },
  { label: "Manufacturing", href: "/dashboard/insights/manufacturing" },
  { label: "Purchasing", href: "/dashboard/insights/purchasing" },
];

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
