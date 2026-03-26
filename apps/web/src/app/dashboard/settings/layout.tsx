import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "API Keys", href: "/dashboard/settings" },
  { label: "Webhooks", href: "/dashboard/settings/webhooks" },
  { label: "Users", href: "/dashboard/settings/users" },
  { label: "Tax Rates", href: "/dashboard/settings/tax-rates" },
  { label: "Currencies", href: "/dashboard/settings/currencies" },
  { label: "Factory", href: "/dashboard/settings/factory" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
