"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { login } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

function loginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const apiErr = err.response?.data as { error?: string } | undefined;
    if (apiErr?.error) return apiErr.error;
    if (!err.response) {
      return "Cannot reach the API. Check that the backend is running and NEXT_PUBLIC_API_URL matches its port.";
    }
  }
  return "Invalid credentials";
}

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
    } catch (err) {
      addToast(loginErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4">
      <div className="w-full max-w-[400px]">
        <div className="card p-8 shadow-lg border-gray-200/90">
          <div className="text-center mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-navy-800 text-white text-lg font-bold mb-4">
              F
            </div>
            <h1 className="text-2xl font-bold text-navy-900 tracking-tight">ForgeERP</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full mt-2" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Manufacturing ERP</p>
      </div>
    </div>
  );
}
