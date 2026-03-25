import { SubTabs } from "@/components/layout/SubTabs";

const tabs = [
  { label: "Products", href: "/dashboard/items/products" },
  { label: "Materials", href: "/dashboard/items/materials" },
  { label: "Services", href: "/dashboard/items/services" },
  { label: "Locations", href: "/dashboard/items/locations" },
];

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <SubTabs tabs={tabs} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
