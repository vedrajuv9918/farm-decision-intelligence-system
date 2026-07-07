import { Settings } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <Settings className="text-farm-blue" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-blue">Settings</p>
            <h2 className="font-display text-3xl font-bold text-slate-900">Preferences</h2>
          </div>
        </div>
      </section>
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Weather alerts
            <input type="checkbox" defaultChecked />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Mandi price alerts
            <input type="checkbox" defaultChecked />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Expense anomaly alerts
            <input type="checkbox" defaultChecked />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            Advisor weekly summary
            <input type="checkbox" />
          </label>
        </div>
      </section>
    </div>
  );
}
