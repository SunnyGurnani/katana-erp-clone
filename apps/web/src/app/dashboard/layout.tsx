import { TopNav } from "@/components/layout/TopNav";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
