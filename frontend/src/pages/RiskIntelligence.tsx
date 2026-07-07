import { AlertTriangle, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { TrendChart } from "../components/Charts";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { EmptyState, ErrorPanel, Explainability, Field, inputClass, LoadingSkeleton, seasonOptions } from "../components/ui";
import { riskAnalysis } from "../services/api";
import type { Location, RiskAnalysisResponse } from "../types/api";

export function RiskIntelligence({
  riskData,
  setRiskData
}: {
  riskData: RiskAnalysisResponse | null;
  setRiskData: (data: RiskAnalysisResponse) => void;
}) {
  const [location, setLocation] = useState<Location | null>(null);
  const [crop, setCrop] = useState("");
  const [soilType, setSoilType] = useState("");
  const [season, setSeason] = useState("Kharif");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!location) {
      setError("Select a farm location before risk analysis.");
      return;
    }
    if (!crop.trim()) {
      setError("Enter a crop before risk analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRiskData(await riskAnalysis({ location, crop, season, soil_type: soilType.trim() || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  const weatherChart = riskData
    ? [
        { label: "Temperature", value: riskData.weather.temperature },
        { label: "Humidity", value: riskData.weather.humidity },
        { label: "Rainfall", value: riskData.weather.rainfall },
        { label: "Wind", value: riskData.weather.wind_speed }
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Risk Intelligence</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Monitor drought, rainfall, heat, humidity, and wind risk</h2>
          </div>
          <button onClick={analyze} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-5 py-3 font-semibold text-white disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            Analyze Risk
          </button>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Field label="Farm Location">
              <LocationAutocomplete value={location} onChange={setLocation} label="Search farm location" />
            </Field>
          </div>
          <Field label="Crop">
            <input className={inputClass} placeholder="Example: Rice, Coconut, Wheat" value={crop} onChange={(event) => setCrop(event.target.value)} />
          </Field>
          <Field label="Soil Type" helper="Improves crop-soil compatibility scoring.">
            <input className={inputClass} placeholder="Example: Loamy, Clay, Laterite" value={soilType} onChange={(event) => setSoilType(event.target.value)} />
          </Field>
          <Field label="Season" helper={seasonOptions.find((item) => item.value === season)?.helper}>
            <select className={inputClass} value={season} onChange={(event) => setSeason(event.target.value)}>
              {seasonOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.icon} - {item.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error ? <div className="mt-4"><ErrorPanel message={error} /></div> : null}
      </section>

      {loading ? <LoadingSkeleton /> : null}
      {riskData ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-lg bg-white p-6 shadow-soft">
              <AlertTriangle className={riskData.risk === "high" ? "text-red-700" : "text-yellow-700"} />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Risk Score</p>
              <h3 className="mt-2 font-display text-4xl font-bold capitalize text-slate-900">{riskData.risk}</h3>
              <p className="mt-2 text-sm text-slate-600">Score: {(riskData.score * 100).toFixed(0)} / 100</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{riskData.alert}</p>
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-red-800">Live Weather Context</p>
                <p>Rainfall: {riskData.weather.rainfall.toFixed(1)} mm ({riskData.weather.rainfall_period})</p>
                <p>{riskData.weather.forecast_summary ?? "Forecast summary unavailable."}</p>
                <p>Anomalies: {riskData.weather.anomalies.length ? riskData.weather.anomalies.join(", ") : "None detected"}</p>
              </div>
            </article>
            <div>
              <h3 className="mb-3 font-display text-xl font-bold text-slate-900">Weather Risk Inputs</h3>
              <TrendChart data={weatherChart} color="#B91C1C" />
            </div>
          </div>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {["Crop-region fit", "Season and soil fit", "Rainfall analysis", "Weather anomaly analysis"].map((title, index) => (
              <article key={title} className="rounded-lg bg-white p-5 shadow-soft">
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{riskData.factors[index] ?? "Current signal is within normal range."}</p>
              </article>
            ))}
          </section>
          <Explainability reasons={riskData.factors} />
        </>
      ) : (
        <EmptyState title="No risk analysis yet" body="Run live weather risk analysis to assess drought, rainfall, heat, humidity, and wind pressure." />
      )}
    </div>
  );
}
