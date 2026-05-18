"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type UnitOfMeasure = { id: string; name: string };

function unwrapUnits(body: unknown): UnitOfMeasure[] {
  if (Array.isArray((body as { data?: unknown })?.data)) {
    return (body as { data: UnitOfMeasure[] }).data;
  }
  if (Array.isArray(body)) return body as UnitOfMeasure[];
  return [];
}

export function useUnitsOfMeasure() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["units-of-measure"],
    queryFn: () => api.get("/units-of-measure").then((r) => unwrapUnits(r.data)),
    retry: false,
  });

  return {
    units: data ?? [],
    isLoading,
    isError,
  };
}
