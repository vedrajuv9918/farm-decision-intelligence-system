import { BadgeIndianRupee, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { ExpenseChart } from "../components/Charts";
import { EmptyState, ErrorPanel, Explainability, Field, inputClass, LoadingSkeleton } from "../components/ui";
import { expenseAnalysis } from "../services/api";
import type { ExpenseAnalysisResponse } from "../types/api";

export function ExpenseIntelligence({
  expenseData,
  setExpenseData
}: {
  expenseData: ExpenseAnalysisResponse | null;
  setExpenseData: (data: ExpenseAnalysisResponse) => void;
}) {
  const [crop, setCrop] = useState("Rice");
  const [acreage, setAcreage] = useState(2);
  const [fertilizer, setFertilizer] = useState(16000);
  const [labor, setLabor] = useState(24000);
  const [irrigation, setIrrigation] = useState(9000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (acreage <= 0) {
      setError("Farm size must be greater than zero.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await expenseAnalysis({
        crop,
        acreage,
        fertilizer_cost: fertilizer,
        labor_cost: labor,
        irrigation_cost: irrigation
      });
      localStorage.setItem(
        "farmwise_cache_expense_inputs",
        JSON.stringify({ crop, acreage, fertilizer_cost: fertilizer, labor_cost: labor, irrigation_cost: irrigation })
      );
      setExpenseData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Expense analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-yellow-700">Expense Intelligence</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Detect overspending and optimize farm costs</h2>
          </div>
          <button onClick={analyze} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-farm-yellow px-5 py-3 font-semibold text-slate-900 disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            Analyze Expenses
          </button>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Field label="Crop">
            <input className={inputClass} placeholder="Example: Rice" value={crop} onChange={(event) => setCrop(event.target.value)} />
          </Field>
          <Field label="Farm Size" helper="Total crop area in acres.">
            <input className={inputClass} type="number" min="0.1" step="0.1" placeholder="Example: 2" value={acreage} onChange={(event) => setAcreage(Number(event.target.value))} />
          </Field>
          <Field label="Fertilizer Cost" helper="Total spend for this crop cycle.">
            <input className={inputClass} type="number" placeholder="Example: 16000" value={fertilizer} onChange={(event) => setFertilizer(Number(event.target.value))} />
          </Field>
          <Field label="Labor Cost">
            <input className={inputClass} type="number" placeholder="Example: 24000" value={labor} onChange={(event) => setLabor(Number(event.target.value))} />
          </Field>
          <Field label="Irrigation Cost">
            <input className={inputClass} type="number" placeholder="Example: 9000" value={irrigation} onChange={(event) => setIrrigation(Number(event.target.value))} />
          </Field>
        </div>
        {error ? <div className="mt-4"><ErrorPanel message={error} /></div> : null}
      </section>

      {loading ? <LoadingSkeleton /> : null}
      {expenseData ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <section>
              <h3 className="mb-3 font-display text-xl font-bold text-slate-900">Expense Comparison</h3>
              <ExpenseChart data={expenseData.comparison} />
            </section>
            <section className="rounded-lg bg-white p-6 shadow-soft">
              <BadgeIndianRupee className="text-yellow-700" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Anomaly Detection</p>
              <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">{expenseData.status}</h3>
              <p className="mt-2 text-sm text-slate-600">IsolationForest score: {expenseData.anomaly_score}</p>
              <div className="mt-4 space-y-3">
                {expenseData.insights.map((insight) => (
                  <div key={insight.alert} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">{insight.alert}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{insight.suggestion}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <Explainability
            reasons={[
              "Each cost is converted to a per-acre benchmark before comparison.",
              "Overspending alerts trigger when a category is materially above baseline.",
              "IsolationForest adds anomaly detection for unusual total cost patterns.",
              "Suggestions focus on reducing costs without blindly cutting yield-critical inputs."
            ]}
          />
        </>
      ) : (
        <EmptyState title="No expense analysis yet" body="Enter crop cycle costs to identify overspending, anomalies, and optimization suggestions." />
      )}
    </div>
  );
}
