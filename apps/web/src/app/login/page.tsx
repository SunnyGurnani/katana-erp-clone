"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("admin@forgeerp.com");
  const [password, setPassword] = useState("Admin1234!");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard/sell");
    } catch {
      addToast("Invalid credentials", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/register", {
        email,
        password,
        fullName: fullName || email.split("@")[0],
        tenantName: tenantName || undefined,
      });
      // Auto-login after registration
      await login(email, password);
      router.push("/dashboard/sell");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Registration failed";
      addToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-navy-800 mb-1">ForgeERP</h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === "login" ? "Sign in to your account" : "Create a new account"}
        </p>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-xs text-center text-gray-500">
              No account?{" "}
              <button type="button" className="text-brand-600 hover:underline" onClick={() => setMode("register")}>
                Register
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="John Doe" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="label">Company Name <span className="text-gray-400">(optional)</span></label>
              <input className="input" type="text" value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="My Company Inc" />
              <p className="text-[10px] text-gray-400 mt-1">Creates a new organization. Leave blank to join an existing one later.</p>
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Creating account..." : "Register"}
            </button>
            <p className="text-xs text-center text-gray-500">
              Already have an account?{" "}
              <button type="button" className="text-brand-600 hover:underline" onClick={() => setMode("login")}>
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
