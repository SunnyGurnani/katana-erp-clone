"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { locationOptions } from "@/lib/catalogOptions";
import { useState, useEffect, useMemo } from "react";

export default function FactorySettingsPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["factory"], queryFn: () => api.get("/factory").then(r => r.data).catch(() => ({})) });

  const [form, setForm] = useState({ name: "", defaultLocationId: "", timezone: "", workingHoursStart: "09:00", workingHoursEnd: "17:00", workingDays: "1,2,3,4,5" });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name || "",
        defaultLocationId: data.defaultLocationId || "",
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        workingHoursStart: data.workingHoursStart || "09:00",
        workingHoursEnd: data.workingHoursEnd || "17:00",
        workingDays: data.workingDays || "1,2,3,4,5",
      });
    }
  }, [data]);

  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then(r => r.data.data || r.data) });
  const locOpts = useMemo(() => locationOptions(locations), [locations]);

  const save = useMutation({
    mutationFn: (d: any) => api.put("/factory", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["factory"] }); addToast("Factory settings saved", "success"); },
    onError: () => addToast("Error saving factory settings", "error"),
  });

  if (isLoading) return <div className="p-6"><table className="table"><tbody><SkeletonRows rows={4} /></tbody></table></div>;

  return (
    <div className="px-4 py-3 space-y-4 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-gray-900">Factory Settings</h1><p className="text-sm text-gray-500">Configure your factory defaults</p></div>

      <div className="card p-5 space-y-4">
        <div><label className="label">Factory Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Factory" /></div>
        <div>
          <label className="label">Default location</label>
          <SearchableSelect
            value={form.defaultLocationId}
            onChange={(v) => setForm((f) => ({ ...f, defaultLocationId: v }))}
            options={locOpts}
            placeholder="Search locations…"
            emptyOptionLabel="— Select —"
            aria-label="Default location"
          />
        </div>
        <div><label className="label">Timezone</label><input className="input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Working Hours Start</label><input className="input" type="time" value={form.workingHoursStart} onChange={e => setForm(f => ({ ...f, workingHoursStart: e.target.value }))} /></div>
          <div><label className="label">Working Hours End</label><input className="input" type="time" value={form.workingHoursEnd} onChange={e => setForm(f => ({ ...f, workingHoursEnd: e.target.value }))} /></div>
        </div>
        <div><label className="label">Working Days (comma-separated: 1=Mon … 7=Sun)</label><input className="input" value={form.workingDays} onChange={e => setForm(f => ({ ...f, workingDays: e.target.value }))} placeholder="1,2,3,4,5" /></div>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>{save.isPending ? "Saving..." : "Save Settings"}</button>
      </div>
    </div>
  );
}
