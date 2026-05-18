import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Planning", href: "/dashboard/plan" },
  { label: "Replenishment", href: "/dashboard/plan/replenishment" },
];

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
