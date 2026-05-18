"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; value: number };

export function InsightsBarChart({
  data,
  valuePrefix = "",
  valueFormatter,
  color = "#1565C0",
}: {
  data: Point[];
  valuePrefix?: string;
  valueFormatter?: (v: number) => string;
  color?: string;
}) {
  if (!data.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No data for chart</p>;
  }

  const fmt = valueFormatter ?? ((v: number) => `${valuePrefix}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip formatter={(v) => fmt(Number(v))} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
