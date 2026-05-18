"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  Circle,
  Package,
  Boxes,
  ShoppingCart,
  Factory,
  MapPin,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";

type Step = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
  icon: React.ReactNode;
};

export default function HomePage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats").then((r) => r.data),
    retry: false,
  });

  const steps: Step[] = [
    {
      id: "products",
      title: "Add your products",
      description: "Create products and variants you sell or manufacture.",
      href: "/dashboard/items/products",
      done: (stats?.productCount ?? 0) > 0,
      icon: <Package size={18} />,
    },
    {
      id: "materials",
      title: "Add materials",
      description: "Set up raw materials and components for bills of materials.",
      href: "/dashboard/items/materials",
      done: (stats?.materialCount ?? 0) > 0,
      icon: <Boxes size={18} />,
    },
    {
      id: "locations",
      title: "Configure locations",
      description: "Define warehouses and production sites for stock tracking.",
      href: "/dashboard/items/locations",
      done: (stats?.locationCount ?? 0) > 0,
      icon: <MapPin size={18} />,
    },
    {
      id: "factory",
      title: "Set up factory settings",
      description: "Working hours, default location, and production defaults.",
      href: "/dashboard/settings/factory",
      done: Boolean(stats?.factoryConfigured),
      icon: <Factory size={18} />,
    },
    {
      id: "sell",
      title: "Create your first sales order",
      description: "Start selling — track demand and fulfillment.",
      href: "/dashboard/sell?newSo=1",
      done: (stats?.openSalesOrders ?? 0) > 0,
      icon: <ShoppingCart size={18} />,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to ForgeERP</h1>
        <p className="text-sm text-gray-500 mt-1">
          Get your manufacturing workflow running. Complete the checklist below to get started.
        </p>
      </header>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Setup progress</span>
          <span className="text-sm font-semibold text-brand-700">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completed} of {steps.length} steps completed
        </p>
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={clsx(
                "card flex items-start gap-4 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30",
                step.done && "border-green-200 bg-green-50/40",
              )}
            >
              <span
                className={clsx(
                  "mt-0.5 shrink-0",
                  step.done ? "text-green-600" : "text-gray-300",
                )}
              >
                {step.done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
              </span>
              <span className="rounded-lg p-2 bg-gray-100 text-gray-600 shrink-0">
                {step.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 block">{step.title}</span>
                <span className="text-sm text-gray-500">{step.description}</span>
              </span>
              <ArrowRight size={16} className="text-gray-400 shrink-0 mt-1" />
            </Link>
          </li>
        ))}
      </ul>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Products", value: stats.productCount },
            { label: "Materials", value: stats.materialCount },
            { label: "Open SOs", value: stats.openSalesOrders },
            { label: "Open MOs", value: stats.openMfgOrders },
          ].map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value ?? 0}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}