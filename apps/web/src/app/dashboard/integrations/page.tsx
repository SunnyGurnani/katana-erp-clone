"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Calculator, RefreshCw, Users, FileText, Receipt } from "lucide-react";

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [expenseAccount, setExpenseAccount] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["quickbooks-status"],
    queryFn: () => api.get("/accounting/quickbooks/status").then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    const acct = status?.settings?.accountMappings?.expenseAccount;
    if (acct) setExpenseAccount(String(acct));
  }, [status]);

  const { data: syncLogs } = useQuery({
    queryKey: ["quickbooks-sync-logs"],
    queryFn: () => api.get("/accounting/quickbooks/sync-logs", { params: { pageSize: 20 } }).then((r) => r.data.data || []),
    enabled: Boolean(status?.connected),
  });

  const connect = useMutation({
    mutationFn: () => api.post("/accounting/quickbooks/connect", {}),
    onSuccess: (res) => {
      const url = res.data.authorizationUrl;
      if (url) window.location.href = url;
      else addToast("Could not start QuickBooks authorization", "error");
    },
    onError: (err: any) => {
      addToast(err.response?.data?.error || "QuickBooks is not configured on the server", "error");
    },
  });

  const disconnect = useMutation({
    mutationFn: () => api.post("/accounting/quickbooks/disconnect"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quickbooks-status"] });
      addToast("Disconnected from QuickBooks", "success");
    },
    onError: () => addToast("Could not disconnect", "error"),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      api.post("/accounting/quickbooks/settings", {
        accountMappings: { expenseAccount: expenseAccount || "7" },
        syncToggles: { invoices: true, bills: true, contacts: true },
      }),
    onSuccess: () => addToast("Settings saved", "success"),
    onError: () => addToast("Could not save settings", "error"),
  });

  const syncContacts = useMutation({
    mutationFn: () => api.post("/accounting/quickbooks/sync/contacts"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      qc.invalidateQueries({ queryKey: ["quickbooks-status"] });
      addToast(`Synced ${res.data.synced} contacts to QuickBooks`, "success");
    },
    onError: (err: any) => addToast(err.response?.data?.error || "Contact sync failed", "error"),
  });

  const syncInvoices = useMutation({
    mutationFn: () => api.post("/accounting/quickbooks/sync/invoices", {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      addToast(`Synced ${res.data.synced} invoices`, "success");
    },
    onError: (err: any) => addToast(err.response?.data?.error || "Invoice sync failed", "error"),
  });

  const syncBills = useMutation({
    mutationFn: () => api.post("/accounting/quickbooks/sync/bills", {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["quickbooks-sync-logs"] });
      addToast(`Synced ${res.data.synced} bills`, "success");
    },
    onError: (err: any) => addToast(err.response?.data?.error || "Bill sync failed", "error"),
  });

  const configured = status?.configured !== false;
  const connected = Boolean(status?.connected);
  const syncing = syncContacts.isPending || syncInvoices.isPending || syncBills.isPending;

  return (
    <div className="px-8 py-6 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator size={22} className="text-[#2CA01C]" />
          QuickBooks Online
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect ForgeERP to QuickBooks Online to sync customers, vendors, invoices, and bills.
        </p>
      </header>

      {!configured && !isLoading && (
        <div className="card p-5 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            QuickBooks OAuth is not configured on the server. Set <code className="text-xs bg-white px-1 rounded">QUICKBOOKS_CLIENT_ID</code>,{" "}
            <code className="text-xs bg-white px-1 rounded">QUICKBOOKS_CLIENT_SECRET</code>,{" "}
            <code className="text-xs bg-white px-1 rounded">QUICKBOOKS_REDIRECT_URI</code> (use{" "}
            <code className="text-xs bg-white px-1 rounded">http://localhost:3000/dashboard/integrations/callback</code>), and{" "}
            <code className="text-xs bg-white px-1 rounded">INTEGRATION_ENCRYPTION_KEY</code> in the API environment.
          </p>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Connection</p>
            {isLoading ? (
              <p className="text-sm text-gray-500">Checking status…</p>
            ) : connected ? (
              <p className="text-sm text-green-700">
                Connected · Company {status?.realmId || "—"}
                {status?.lastSyncAt && (
                  <span className="text-gray-500"> · Last sync {new Date(status.lastSyncAt).toLocaleString()}</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>
          {connected ? (
            <button type="button" className="btn btn-ghost text-red-600" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              Disconnect
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => connect.mutate()} disabled={!configured || connect.isPending}>
              {connect.isPending ? "Redirecting…" : "Connect to QuickBooks"}
            </button>
          )}
        </div>

        {connected && (
          <>
            <div className="border-t border-gray-100 pt-4">
              <label className="label">Expense account ID (for bills)</label>
              <p className="text-xs text-gray-500 mb-1">QuickBooks account ID used on purchase bill lines (default 7 in sandbox).</p>
              <div className="flex gap-2">
                <input className="input flex-1" value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)} placeholder="7" />
                <button type="button" className="btn btn-ghost" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                  Save
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="font-semibold text-gray-900 mb-3">Sync to QuickBooks</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost text-sm flex items-center gap-1.5" disabled={syncing} onClick={() => syncContacts.mutate()}>
                  <Users size={14} /> {syncContacts.isPending ? "Syncing…" : "Customers & vendors"}
                </button>
                <button type="button" className="btn btn-ghost text-sm flex items-center gap-1.5" disabled={syncing} onClick={() => syncInvoices.mutate()}>
                  <FileText size={14} /> {syncInvoices.isPending ? "Syncing…" : "Sales invoices"}
                </button>
                <button type="button" className="btn btn-ghost text-sm flex items-center gap-1.5" disabled={syncing} onClick={() => syncBills.mutate()}>
                  <Receipt size={14} /> {syncBills.isPending ? "Syncing…" : "Purchase bills"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {connected && syncLogs && syncLogs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <RefreshCw size={14} className="text-gray-400" />
            <h2 className="font-semibold text-sm text-gray-800">Recent sync activity</h2>
          </div>
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Status</th>
                <th>External ID</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log: any) => (
                <tr key={log.id}>
                  <td className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.entityType}</td>
                  <td>
                    <span className={log.status === "success" ? "text-green-700" : "text-red-600"}>{log.status}</span>
                  </td>
                  <td className="font-mono text-xs">{log.externalId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
