"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,      // 5 min — safe for ERP data that changes infrequently
        gcTime: 15 * 60_000,        // 15 min — keep cache warm across navigation
        refetchOnWindowFocus: false, // avoid surprise re-fetches on tab switch
        refetchOnReconnect: true,    // always re-sync on network restore
        retry: 2,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30_000),
      }
    }
  }));
  return <QueryClientProvider client={qc}><ToastProvider>{children}</ToastProvider></QueryClientProvider>;
}
