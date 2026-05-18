"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";

function QuickBooksCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing QuickBooks connection…");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const realmId = searchParams.get("realmId");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(`QuickBooks authorization failed: ${oauthError}`);
      return;
    }
    if (!code) {
      setError("Missing authorization code from QuickBooks.");
      return;
    }

    api
      .post("/accounting/quickbooks/complete", { code, realmId: realmId || undefined })
      .then(() => {
        setMessage("QuickBooks connected successfully. Redirecting…");
        setTimeout(() => router.replace("/dashboard/integrations"), 1500);
      })
      .catch((err: any) => {
        setError(err.response?.data?.error || err.message || "Connection failed");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-6">
      <div className="card p-8 max-w-md w-full text-center space-y-4">
        <h1 className="text-lg font-bold text-gray-900">QuickBooks Online</h1>
        {error ? (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <Link href="/dashboard/integrations" className="btn btn-primary inline-block">
              Back to integrations
            </Link>
          </>
        ) : (
          <p className="text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
}

export default function QuickBooksCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <QuickBooksCallbackContent />
    </Suspense>
  );
}
