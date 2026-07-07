import { Loader2, Search, TrendingUp } from "lucide-react";
import { useState } from "react";
import { LineTrendChart, TrendChart } from "../components/Charts";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { EmptyState, ErrorPanel, Explainability, Field, inputClass, LoadingSkeleton } from "../components/ui";
import { marketDecision } from "../services/api";
import type { Location, MarketDecisionResponse } from "../types/api";

export function MarketIntelligence({
  marketData,
  setMarketData
}: {
  marketData: MarketDecisionResponse | null;
  setMarketData: (data: MarketDecisionResponse | null) => void;
}) {
  const [location, setLocation] = useState<Location | null>(null);
  const [crop, setCrop] = useState("");
  const [timeframe, setTimeframe] = useState("weekly");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    if (!location) {
      setError("Select a market location before mandi analysis.");
      return;
    }
    if (!crop.trim()) {
      setError("Enter a crop or commodity before mandi analysis.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await marketDecision({
        crop,
        location,
        timeframe,
        market: selectedMarket || undefined,
        selected_date: selectedDate || undefined
      });
      setMarketData(response);
      if (response.selected_market) setSelectedMarket(response.selected_market);
      if (response.selected_date) setSelectedDate(response.selected_date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Market analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-blue">Market Intelligence</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Decide when and where to sell</h2>
          </div>
          <button onClick={analyze} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-farm-blue px-5 py-3 font-semibold text-white disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            Analyze Market
          </button>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Field label="Market Location" helper="State is used to filter Agmarknet mandi records.">
              <LocationAutocomplete
                value={location}
                onChange={(nextLocation) => {
                  setLocation(nextLocation);
                  setSelectedMarket("");
                  setSelectedDate("");
                  setMarketData(null);
                }}
                label="Search state or district"
              />
            </Field>
          </div>
          <Field label="Crop / Commodity">
            <input
              className={inputClass}
              placeholder="Example: Wheat, Maize, Cotton"
              value={crop}
              onChange={(event) => {
                setCrop(event.target.value);
                setSelectedMarket("");
                setMarketData(null);
              }}
            />
          </Field>
          <Field label="Selected Mandi" helper="Blank selects the highest latest modal price for this commodity/date.">
            <input className={inputClass} placeholder="Optional: exact mandi name from selected state" value={selectedMarket} onChange={(event) => setSelectedMarket(event.target.value)} />
          </Field>
          <Field label="Selected Date" helper="Blank uses the latest available Agmarknet date.">
            <input className={inputClass} type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </Field>
        </div>
        {error ? <div className="mt-4"><ErrorPanel message={error} /></div> : null}
      </section>

      {loading ? <LoadingSkeleton /> : null}
      {marketData ? (
        <>
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-lg bg-white p-6 shadow-soft">
              <TrendingUp className="text-farm-blue" />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                {marketData.is_prediction ? "Predicted Market Prices" : "Recommendation"}
              </p>
              <h3 className="mt-2 font-display text-4xl font-bold text-slate-900">{marketData.decision}</h3>
              <p className="mt-3 text-sm capitalize text-slate-600">Trend: {marketData.trend}</p>
              <p className="mt-1 text-sm text-slate-600">Recommendation confidence: {(marketData.recommendation_confidence * 100).toFixed(0)}%</p>
              <p className="mt-3 font-semibold text-slate-900">Selected Mandi: {marketData.best_market}</p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="font-semibold text-slate-700">{marketData.is_prediction ? "Predicted modal price" : "Selected modal price"}</p>
                  <p className="text-xl font-bold text-farm-blue">
                    {marketData.selected_modal_price ? `Rs ${marketData.selected_modal_price.toLocaleString("en-IN")}/quintal` : "Not available"}
                  </p>
                </div>
                {marketData.is_prediction && marketData.records[0] ? (
                  <>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="font-semibold text-slate-700">Predicted min price</p>
                      <p className="text-xl font-bold text-farm-blue">Rs {marketData.records[0].min_price.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="font-semibold text-slate-700">Predicted max price</p>
                      <p className="text-xl font-bold text-farm-blue">Rs {marketData.records[0].max_price.toLocaleString("en-IN")}</p>
                    </div>
                  </>
                ) : null}
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Historical Average</p>
                  <p className="text-xl font-bold text-slate-900">
                    {marketData.historical_average ? `Rs ${marketData.historical_average.toLocaleString("en-IN")}` : "Insufficient history"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Moving Average</p>
                  <p className="text-xl font-bold text-slate-900">
                    {marketData.moving_average ? `Rs ${marketData.moving_average.toLocaleString("en-IN")}` : "Insufficient history"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Volatility</p>
                  <p className="text-xl font-bold text-slate-900">
                    {marketData.volatility ? `Rs ${marketData.volatility.toLocaleString("en-IN")}` : "Insufficient history"}
                  </p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="font-semibold text-slate-700">7-day predicted price</p>
                  <p className="text-xl font-bold text-farm-green">
                    {marketData.predicted_price ? `Rs ${marketData.predicted_price.toLocaleString("en-IN")}` : "Unavailable"}
                  </p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-3">
                  <p className="font-semibold text-slate-700">Prediction confidence</p>
                  <p className="text-xl font-bold text-yellow-700">
                    {(marketData.prediction_confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{marketData.context_label}</p>
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-slate-700">
                <p className="font-bold text-farm-blue">Live API Context</p>
                <p>Selected state: {location?.state || "Not available"}</p>
                <p>Selected mandi: {marketData.selected_market || selectedMarket || "Auto-selected from live data"}</p>
                <p>Selected commodity: {crop}</p>
                <p>Source: {marketData.api_source}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{marketData.explanation}</p>
              {marketData.forecast_message ? (
                <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-farm-green">{marketData.forecast_message}</p>
              ) : null}
            </article>
            <div>
              <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Mandi Price History</h3>
                  <p className="mt-1 text-sm text-slate-500">Real historical modal prices from Agmarknet.</p>
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                  {[
                    ["weekly", "Weekly"],
                    ["monthly", "Monthly"],
                    ["yearly", "Yearly"],
                    ["alltime", "Alltime"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={async () => {
                        setTimeframe(value);
                        if (location) {
                          setLoading(true);
                          try {
                            const response = await marketDecision({
                              crop,
                              location,
                              timeframe: value,
                              market: selectedMarket || undefined,
                              selected_date: selectedDate || undefined
                            });
                            setMarketData(response);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Market analysis failed.");
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                        timeframe === value ? "border-farm-blue bg-blue-50 text-farm-blue" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {marketData.price_trend.length > 1 ? (
                timeframe === "weekly" ? <LineTrendChart data={marketData.price_trend} color="#1E3A8A" /> : <TrendChart data={marketData.price_trend} color="#1E3A8A" />
              ) : (
                <EmptyState title="Insufficient historical data" body={marketData.history_message ?? "Insufficient historical mandi data available for trend analysis. Showing the latest market snapshot only."} />
              )}
              {marketData.forecast_points.length > 1 ? (
                <div className="mt-5">
                  <h3 className="mb-3 font-display text-xl font-bold text-slate-900">7-day Price Forecast</h3>
                  <LineTrendChart data={marketData.forecast_points} color="#2E7D32" />
                </div>
              ) : null}
            </div>
          </div>
          <section className="rounded-lg bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-xl font-bold text-slate-900">Nearby Mandis</h3>
              <p className="text-sm text-slate-500">{marketData.comparison_label}</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {marketData.nearby_records?.slice(0, 6).map((record) => (
                <button
                  key={`${record.market}-${record.arrival_date}-${record.modal_price}`}
                  className="rounded-lg bg-slate-50 p-4 text-left hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{record.market}</p>
                    {record.market === marketData.selected_market ? (
                      <span className="rounded-full bg-farm-green px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Selected Mandi</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{record.district}, {record.state}</p>
                  <p className="mt-3 text-xl font-bold text-farm-blue">Rs {record.modal_price.toLocaleString("en-IN")}</p>
                  <p className="mt-1 text-xs text-slate-500">Date: {record.arrival_date}</p>
                </button>
              ))}
            </div>
          </section>
          <Explainability
            reasons={[
              `Current price trend is ${marketData.trend}.`,
              marketData.history_available ? `Recommendation confidence is ${(marketData.recommendation_confidence * 100).toFixed(0)}% because enough dated mandi history was available.` : "Limited confidence due to insufficient historical mandi data; this is a latest snapshot, not a forecast.",
              marketData.predicted_price ? `7-day predicted modal price is Rs ${marketData.predicted_price.toLocaleString("en-IN")} with ${(marketData.prediction_confidence * 100).toFixed(0)}% confidence.` : "Prediction is disabled when too few historical days match the selected market and commodity.",
              marketData.best_market ? `${marketData.best_market} has the best modal price in the returned records.` : "Best mandi is selected from available modal prices.",
              marketData.latest_price ? `Latest average modal price is Rs ${marketData.latest_price.toLocaleString("en-IN")}.` : "Price records were cleaned before trend analysis.",
              "WAIT / SELL recommendation compares latest price against recent averages."
            ]}
          />
        </>
      ) : (
        <EmptyState title="No mandi analysis yet" body="Select a crop and market location to compare mandi prices, trend, and sell timing." />
      )}
    </div>
  );
}
