import type { ReactNode } from "react";

type Props = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  accent?: "green" | "blue" | "yellow" | "red";
};

const accentClasses = {
  green: "bg-green-50 text-farm-green",
  blue: "bg-blue-50 text-farm-blue",
  yellow: "bg-yellow-50 text-yellow-700",
  red: "bg-red-50 text-red-700"
};

export function MetricCard({ title, value, subtitle, icon, accent = "green" }: Props) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${accentClasses[accent]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-600">{subtitle}</p>
    </div>
  );
}
