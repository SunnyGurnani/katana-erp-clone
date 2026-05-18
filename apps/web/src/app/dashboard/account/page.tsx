"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SkeletonRows } from "@/components/ui/Skeleton";
import Link from "next/link";

export default function AccountPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["users-me"],
    queryFn: () => api.get("/users/me").then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setFullName(data.fullName || "");
      setEmail(data.email || "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.patch(`/users/${data?.id}`, { fullName, email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-me"] });
      addToast("Profile updated", "success");
    },
    onError: () => addToast("Could not update profile", "error"),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6 max-w-xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900">My account</h1>
        <p className="text-sm text-gray-500 mt-1">Your personal profile and sign-in details.</p>
      </header>

      <nav className="flex gap-4 text-sm border-b border-gray-200 pb-2">
        <span className="font-medium text-brand-700 border-b-2 border-brand-600 -mb-2.5 pb-2">Profile</span>
        <Link href="/dashboard/account/company" className="text-gray-500 hover:text-gray-800">
          Company
        </Link>
        <Link href="/dashboard/account/team" className="text-gray-500 hover:text-gray-800">
          Team
        </Link>
      </nav>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
