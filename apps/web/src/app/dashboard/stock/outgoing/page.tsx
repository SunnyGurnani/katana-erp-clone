"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { formatQty } from "@/lib/formatQty";

type OutgoingRow = {
  id: string;
  sourceType: "SO" | "MO";
  orderId: string;
  orderNumber: string;
  partyName: string;
  itemName: string;
  sku: string;
  qtyCommitted: number;
  uom: string;
  status: string;
};

const OPEN_SO = new Set(["confirmed", "partial", "released", "in_progress"]);
const OPEN_MO = new Set(["released", "in_progress", "planned"]);

export default function OutgoingStockPage() {
  const { data: sos, isLoading: soLoading } = useQuery({
    queryKey: ["sales-orders-outgoing"],
    queryFn: () =>
      api.get("/sales-orders", { params: { page: 1, pageSize: 100 } }).then((r) => r.data.data || r.data || []),
  });

  const { data: mos, isLoading: moLoading } = useQuery({
    queryKey: ["manufacturing-outgoing"],
    queryFn: () =>
      api.get("/manufacturing", { params: { page: 1, pageSize: 100 } }).then((r) => r.data.data || r.data || []),
  });

  const rows = useMemo(() => {
    const out: OutgoingRow[] = [];

    for (const so of sos || []) {
      const status = String(so.status || "").toLowerCase();
      if (!OPEN_SO.has(status) && status !== "draft") continue;
      if (status === "draft" || status === "fulfilled" || status === "done") continue;
      for (const row of so.rows || []) {
        const committed = Math.max(
          0,
          Number(row.qtyOrdered || 0) - Number(row.qtyFulfilled || row.qtyShipped || 0),
        );
        if (committed <= 0) continue;
        const v = row.variant;
        out.push({
          id: `so-${row.id}`,
          sourceType: "SO",
          orderId: so.id,
          orderNumber: so.soNumber || so.number,
          partyName: so.customer?.name || "—",
          itemName: v?.product?.name || v?.name || "—",
          sku: v?.sku || "—",
          qtyCommitted: committed,
          uom: v?.product?.unitOfMeasure || "pcs",
          status: so.status,
        });
      }
    }

    for (const mo of mos || []) {
      const status = String(mo.status || "").toLowerCase();
      if (!OPEN_MO.has(status)) continue;
      for (const row of mo.recipeRows || mo.rows || []) {
        const committed = Math.max(
          0,
          Number(row.qtyRequired || row.qtyPlanned || 0) - Number(row.qtyConsumed || 0),
        );
        if (committed <= 0) continue;
        const item = row.material || row.variant;
        out.push({
          id: `mo-${row.id}`,
          sourceType: "MO",
          orderId: mo.id,
          orderNumber: mo.moNumber || mo.number,
          partyName: mo.product?.name || "—",
          itemName: item?.name || "—",
          sku: item?.sku || "—",
          qtyCommitted: committed,
          uom: item?.unitOfMeasure || "pcs",
          status: mo.status,
        });
      }
    }

    return out;
  }, [sos, mos]);

  const columns: Column[] = [
    {
      key: "sourceType",
      header: "Type",
      render: (r: OutgoingRow) => <span className="badge">{r.sourceType}</span>,
    },
    {
      key: "orderNumber",
      header: "Order",
      render: (r: OutgoingRow) => (
        <Link
          href={r.sourceType === "SO" ? `/dashboard/sell/${r.orderId}` : `/dashboard/make/${r.orderId}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {r.orderNumber}
        </Link>
      ),
    },
    { key: "partyName", header: "Customer / Product" },
    { key: "itemName", header: "Item" },
    { key: "sku", header: "SKU", render: (r: OutgoingRow) => <span className="font-mono text-xs">{r.sku}</span> },
    {
      key: "qtyCommitted",
      header: "Committed",
      render: (r: OutgoingRow) => formatQty(r.qtyCommitted, r.uom),
    },
    { key: "status", header: "Status", render: (r: OutgoingRow) => <span className="badge">{r.status}</span> },
  ];

  return (
    <div className="px-4 py-3 space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Outgoing stock</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Committed demand from open sales and manufacturing orders.
        </p>
      </header>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={soLoading || moLoading}
        emptyMessage="No committed outgoing stock"
        showRank
        totalLabel="lines"
      />
    </div>
  );
}
