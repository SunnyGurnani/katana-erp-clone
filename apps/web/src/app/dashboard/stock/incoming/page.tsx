"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { DataTable, Column } from "@/components/ui/DataTable";
import { formatLocalDateDisplay } from "@/lib/formatDate";
import { formatQty } from "@/lib/formatQty";

type IncomingRow = {
  id: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  itemName: string;
  sku: string;
  qtyExpected: number;
  uom: string;
  expectedAt: string | null;
  status: string;
};

export default function IncomingStockPage() {
  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase-orders-incoming"],
    queryFn: () =>
      api
        .get("/purchase-orders", { params: { page: 1, pageSize: 100 } })
        .then((r) => r.data.data || r.data || []),
  });

  const rows = useMemo(() => {
    const out: IncomingRow[] = [];
    for (const po of pos || []) {
      const status = String(po.status || "").toLowerCase();
      if (status === "done" || status === "cancelled") continue;
      for (const row of po.rows || []) {
        const expected = Math.max(0, Number(row.qtyOrdered || row.qty || 0) - Number(row.qtyReceived || 0));
        if (expected <= 0) continue;
        const item = row.variant || row.material;
        out.push({
          id: row.id,
          poId: po.id,
          poNumber: po.poNumber || po.number,
          supplierName: po.supplier?.name || "—",
          itemName: item?.product?.name || item?.name || row.description || "—",
          sku: item?.sku || "—",
          qtyExpected: expected,
          uom: item?.unitOfMeasure || "pcs",
          expectedAt: po.expectedAt || po.expectedDate,
          status: po.status,
        });
      }
    }
    return out;
  }, [pos]);

  const columns: Column[] = [
    {
      key: "poNumber",
      header: "PO",
      render: (r: IncomingRow) => (
        <Link href={`/dashboard/buy/${r.poId}`} className="font-medium text-brand-700 hover:underline">
          {r.poNumber}
        </Link>
      ),
    },
    { key: "supplierName", header: "Supplier" },
    { key: "itemName", header: "Item" },
    { key: "sku", header: "SKU", render: (r: IncomingRow) => <span className="font-mono text-xs">{r.sku}</span> },
    {
      key: "qtyExpected",
      header: "Expected",
      render: (r: IncomingRow) => formatQty(r.qtyExpected, r.uom),
    },
    {
      key: "expectedAt",
      header: "Expected date",
      render: (r: IncomingRow) => formatLocalDateDisplay(r.expectedAt),
    },
    { key: "status", header: "PO status", render: (r: IncomingRow) => <span className="badge">{r.status}</span> },
  ];

  return (
    <div className="px-4 py-3 space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Incoming stock</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Expected quantities from open purchase orders not yet fully received.
        </p>
      </header>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No incoming stock on open purchase orders"
        showRank
        totalLabel="lines"
      />
    </div>
  );
}
