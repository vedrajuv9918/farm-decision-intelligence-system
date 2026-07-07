import { Droplets, Loader2, Search, Sprout } from "lucide-react";
import { useState } from "react";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { ErrorPanel, Explainability, Field, inputClass, LoadingSkeleton, seasonOptions } from "../components/ui";
import { cropDecision, riskAnalysis } from "../services/api";
import type { CropDecisionResponse, Location, RiskAnalysisResponse } from "../types/api";

type Props = {
  cropData: CropDecisionResponse | null;
  riskData: RiskAnalysisResponse | null;
  setCropData: (data: CropDecisionResponse) => void;
  setRiskData: (data: RiskAnalysisResponse) => void;
};

export function CropIntelligence({ cropData, riskData, setCropData, setRiskData }: Props) {
  const [location, setLocation] = useState<Location | null>(null);
  const [soilType, setSoilType] = useState("Loamy");
  const [season, setSeason] = useState("Kharif");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!location) {
      setError("Select a farm location before crop analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [crop, risk] = await Promise.all([
        cropDecision({ location, soil_type: soilType, season }),
        riskAnalysis({ location, crop: "Primary crop", season })
      ]);
      setCropData(crop);
      setRiskData(risk);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crop analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-green">Crop Intelligence</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Choose what to grow with profit and risk context</h2>
          </div>
          <button onClick={analyze} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-farm-green px-5 py-3 font-semibold text-white disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            Analyze Crops
          </button>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Field label="Farm Location" helper="Used for live weather, regional crop fit, and climate risk.">
              <LocationAutocomplete value={location} onChange={setLocation} label="Search farm location" />
            </Field>
          </div>
          <Field label="Soil Type" helper="Example: Loamy, Black, Red, Sandy, Clay, Laterite.">
            <input className={inputClass} placeholder="Loamy soil" value={soilType} onChange={(event) => setSoilType(event.target.value)} />
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

      {cropData ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {cropData.recommendations.map((item) => (
              <article key={item.crop} className="rounded-lg bg-white p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900">{item.crop}</h3>
                    <p className="mt-1 text-sm text-slate-500">Confidence {(item.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-farm-green">{item.decision}</span>
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-900">Rs {item.profit.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-sm text-slate-500">Estimated profit per acre</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">Expected yield</p>
                    <p className="text-slate-600">{item.expected_yield || Math.max(8, Math.round(item.profit / 3000))} qtl/acre</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">Water need</p>
                    <p className="flex items-center gap-1 text-slate-600"><Droplets size={14} /> {item.water_requirement}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-green-50 p-3">
                    <p className="font-semibold text-slate-900">Suitability</p>
                    <p className="text-farm-green">{item.suitability_score.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="font-semibold text-slate-900">Mandi price</p>
                    <p className="text-farm-blue">{item.market_price ? `Rs ${item.market_price.toLocaleString("en-IN")}` : "Baseline"}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{item.explanation}</p>
                {item.reasons?.length ? (
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                    {item.reasons.slice(0, 3).map((reason) => (
                      <li key={reason} className="rounded-lg bg-slate-50 px-3 py-2">Check: {reason}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
          <Explainability
            reasons={[
              cropData.recommendations[0]?.explanation ?? "Profitability model ranked the crop using live weather and mandi features.",
              `Risk level is ${riskData?.risk ?? cropData.recommendations[0]?.risk ?? "available"} from temperature, rainfall, humidity, and wind signals.`,
              "Suitability score combines regional fit, soil compatibility, crop season, and live weather.",
              "Profitability is adjusted with available live mandi prices and trained crop economics."
            ]}
          />
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-white p-6 text-slate-600 shadow-soft">
          <Sprout className="text-farm-green" />
          <span>Run crop analysis to compare region-aware crop recommendations.</span>
        </div>
      )}
    </div>
  );
}
