"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("admin@forgeerp.com");
  const [password, setPassword] = useState("Admin1234!");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; code?: string; message?: string };
      const apiErr = ax?.response?.data?.error;
      const network =
        ax?.code === "ERR_NETWORK" ||
        ax?.message === "Network Error" ||
        String(ax?.message || "").includes("Network Error");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const msg =
        apiErr ||
        (network ? `Cannot reach API at ${apiUrl} — start the backend and check NEXT_PUBLIC_API_URL.` : null) ||
        "Invalid credentials";
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-brand-700 mb-1">ForgeERP</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
