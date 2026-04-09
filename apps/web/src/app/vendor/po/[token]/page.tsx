"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

type VendorPoPayload = {
  poNumber: string;
  status: string;
  currency: string;
  expectedAt: string | null;
  supplierName: string | null;
  lines: { description: string; sku: string | null; qty: number; unitCost: number | null }[];
  canRespond: boolean;
  closedReason: string | null;
  vendorResponseComment: string | null;
  vendorRespondedAt: string | null;
};

async function fetchVendorPo(token: string): Promise<VendorPoPayload> {
  const res = await fetch(`${API_BASE}/api/v1/public/vendor-po/${encodeURIComponent(token)}`, {
    credentials: "omit",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load purchase order");
  return data;
}

async function postRespond(token: string, body: { action: string; comment?: string }) {
  const res = await fetch(`${API_BASE}/api/v1/public/vendor-po/${encodeURIComponent(token)}/respond`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function VendorPurchaseOrderPage() {
  const { token } = useParams<{ token: string }>();
  const t = typeof token === "string" ? token : "";
  const [comment, setComment] = useState("");
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vendor-po", t],
    queryFn: () => fetchVendorPo(t),
    enabled: t.length > 0,
    retry: false,
  });

  const respond = useMutation({
    mutationFn: (payload: { action: string; comment?: string }) => postRespond(t, payload),
    onSuccess: (_, variables) => {
      if (variables.action === "confirm") setDoneMsg("Thank you — this purchase order is confirmed.");
      else setDoneMsg("Thank you — your message has been sent to the buyer.");
      void refetch();
      setComment("");
    },
  });

  if (!t) {
    return <div className="min-h-[50vh] flex items-center justify-center p-6 text-gray-500">Invalid link.</div>;
  }

  if (isLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center p-6 text-gray-600">Loading…</div>;
  }

  if (isError || !data) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {(error as Error)?.message || "Could not load this purchase order."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-gray-900">Purchase order {data.poNumber}</h1>
        {data.supplierName && <p className="text-sm text-gray-600 mt-1">{data.supplierName}</p>}
        {data.expectedAt && (
          <p className="text-sm text-gray-600 mt-1">Expected: {String(data.expectedAt).slice(0, 10)}</p>
        )}

        {doneMsg && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">{doneMsg}</div>
        )}

        {!data.canRespond && data.closedReason && !doneMsg && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{data.closedReason}</div>
        )}

        {data.vendorResponseComment && !data.canRespond && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium text-amber-900">Previous message</p>
            <p className="mt-1 whitespace-pre-wrap">{data.vendorResponseComment}</p>
          </div>
        )}

        <div className="mt-6 card overflow-hidden">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="w-24">Qty</th>
                <th className="w-32">Unit</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    <div className="font-medium text-gray-900">{line.description}</div>
                    {line.sku && <div className="text-xs text-gray-500">{line.sku}</div>}
                  </td>
                  <td className="tabular-nums">{line.qty}</td>
                  <td className="tabular-nums whitespace-nowrap">
                    {line.unitCost != null ? `${Number(line.unitCost).toFixed(4)} ${data.currency}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.canRespond && (
          <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-700">
              Confirm this order as shown, or reject / ask for changes. Rejections and change requests require a short message to the buyer.
            </p>
            <div>
              <label className="label">Message (required for reject or changes)</label>
              <textarea
                className="input min-h-[100px]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="e.g. Please change delivery date to … / We cannot supply item X …"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ action: "confirm" })}
              >
                Confirm order
              </button>
              <button
                type="button"
                className="btn btn-ghost border border-red-300 text-red-700 hover:bg-red-50"
                disabled={respond.isPending || !comment.trim()}
                onClick={() => respond.mutate({ action: "reject", comment: comment.trim() })}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn btn-ghost border border-amber-300 text-amber-900 hover:bg-amber-50"
                disabled={respond.isPending || !comment.trim()}
                onClick={() => respond.mutate({ action: "request_changes", comment: comment.trim() })}
              >
                Request modifications
              </button>
            </div>
            {respond.isError && (
              <p className="text-sm text-red-600">{(respond.error as Error).message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
