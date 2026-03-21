import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Schedule", href: "/dashboard/make" },
  { label: "Tasks", href: "/dashboard/make/tasks" },
];

export default function MakeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
