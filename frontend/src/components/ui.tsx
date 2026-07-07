import type { ReactNode } from "react";

export function Field({
  label,
  helper,
  children
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
      {helper ? <span className="mt-1 block text-xs leading-5 text-slate-500">{helper}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-farm-green focus:ring-4 focus:ring-green-100";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft">
      <p className="font-display text-xl font-bold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg bg-white p-5 shadow-soft">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-8 w-36 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div>;
}

export function Explainability({ reasons }: { reasons: string[] }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-soft">
      <h3 className="font-display text-xl font-bold text-slate-900">Why this recommendation?</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {reasons.map((reason) => (
          <div key={reason} className="flex items-start gap-3 rounded-lg bg-green-50 px-3 py-3 text-sm text-slate-700">
            <span className="mt-0.5 text-farm-green">✓</span>
            <span>{reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export const seasonOptions = [
  {
    value: "Kharif",
    label: "Kharif (June - October)",
    icon: "Rain",
    helper: "Monsoon season crops that depend on stronger rainfall."
  },
  {
    value: "Rabi",
    label: "Rabi (November - April)",
    icon: "Winter",
    helper: "Winter season crops usually sown after monsoon."
  },
  {
    value: "Zaid",
    label: "Zaid (March - June)",
    icon: "Sun",
    helper: "Short summer season between Rabi harvest and Kharif sowing."
  }
];
