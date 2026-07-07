import { CalendarDays, Loader2, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineTrendChart, TrendChart } from "../components/Charts";
import { EmptyState, ErrorPanel, Field, inputClass, LoadingSkeleton } from "../components/ui";
import { ApiError, mandiOptions, mandiPrices } from "../services/api";
import type { MandiOptionsResponse, MandiPricesResponse, MarketRecord } from "../types/api";

const timeframes = [
  { value: "weekly", label: "Weekly", helper: "Daily trend" },
  { value: "monthly", label: "Monthly", helper: "Weekly averages" },
  { value: "yearly", label: "Yearly", helper: "Monthly averages" },
  { value: "alltime", label: "Alltime", helper: "Yearly averages" }
];

const attributes = [
  { value: "modal_price", label: "Modal Price" },
  { value: "min_price", label: "Min Price" },
  { value: "max_price", label: "Max Price" }
];

function priceTrend(records: MarketRecord[], record: MarketRecord) {
  const sameCommodity = records
    .filter((item) => item.commodity === record.commodity && item.market === record.market)
    .sort((a, b) => a.arrival_date.localeCompare(b.arrival_date));
  const index = sameCommodity.findIndex((item) => item.arrival_date === record.arrival_date && item.modal_price === record.modal_price);
  if (index <= 0) return "stable";
  const previous = sameCommodity[index - 1];
  if (record.modal_price > previous.modal_price) return "up";
  if (record.modal_price < previous.modal_price) return "down";
  return "stable";
}

function toDateInput(raw: string) {
  const [day, month, year] = raw.split("/");
  return year && month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
}

export function MandiPricesPage() {
  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("farmwise_profile") || "{}") as {
        state?: string;
        primaryCrop?: string;
        location?: { state?: string | null };
      };
    } catch {
      return {};
    }
  }, []);
  const initialState = profile.location?.state || profile.state || "";
  const initialCrop = profile.primaryCrop || "";
  const [crop, setCrop] = useState(initialCrop);
  const [state, setState] = useState(initialState);
  const [market, setMarket] = useState("");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [timeframe, setTimeframe] = useState("weekly");
  const [priceAttribute, setPriceAttribute] = useState("modal_price");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<MandiPricesResponse | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const [options, setOptions] = useState<MandiOptionsResponse>({ states: [], markets: [], commodities: [] });
  const optionsSeq = useRef(0);
  const pricesSeq = useRef(0);
  const autoLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    mandiOptions({ state: initialState || undefined })
      .then((nextOptions) => {
        if (active) setOptions(nextOptions);
      })
      .catch(() => {
        if (active) setError("Unable to load state options. Type a state name manually and refresh.");
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialState]);

  useEffect(() => {
    const seq = ++optionsSeq.current;
    const handle = window.setTimeout(async () => {
      if (!state.trim()) {
        setOptionsLoading(false);
        return;
      }
      setOptionsLoading(true);
      try {
        const nextOptions = await mandiOptions({
          state: state.trim() || undefined,
          market: market.trim() || undefined
        });
        if (seq === optionsSeq.current) setOptions(nextOptions);
      } catch (err) {
        if (seq === optionsSeq.current) setError(err instanceof Error ? err.message : "Unable to load available mandis.");
      } finally {
        if (seq === optionsSeq.current) setOptionsLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [state, market]);

  const fetchPrices = useCallback(async (overrides?: Partial<{ crop: string; state: string; market: string; selectedDate: string; priceAttribute: string; timeframe: string }>) => {
    const nextCrop = overrides?.crop ?? crop;
    const nextState = overrides?.state ?? state;
    const nextMarket = overrides?.market ?? market;
    const nextDate = overrides?.selectedDate ?? selectedDate;
    const nextAttribute = overrides?.priceAttribute ?? priceAttribute;
    const nextTimeframe = overrides?.timeframe ?? timeframe;
    const seq = ++pricesSeq.current;
    setLoading(true);
    setError("");
    if (!nextState.trim()) {
      setLoading(false);
      setError("Select a state to fetch mandi data. Commodity is optional.");
      return;
    }
    try {
      const response = await mandiPrices({
        crop: nextCrop.trim() || undefined,
        state: nextState.trim() || undefined,
        market: nextMarket.trim() || undefined,
        search: search.trim() || undefined,
        selected_date: nextDate || undefined,
        timeframe: nextTimeframe,
        price_attribute: nextAttribute
      });
      if (seq !== pricesSeq.current) return;
      setData(response);
      if (!nextDate && response.selected_date) setSelectedDate(response.selected_date);
      if (response.available_markets.length || response.available_commodities.length) {
        setOptions((current) => ({
          states: current.states,
          markets: response.available_markets,
          commodities: response.available_commodities
        }));
      }
    } catch (err) {
      if (seq !== pricesSeq.current) return;
      if (err instanceof ApiError && err.status === 502) {
        setError("Live mandi service is temporarily unavailable. Try a broader filter, such as only State + Crop, or refresh again.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to fetch mandi prices.");
      }
    } finally {
      if (seq === pricesSeq.current) setLoading(false);
    }
  }, [crop, market, priceAttribute, search, selectedDate, state, timeframe]);

  useEffect(() => {
    if (state.trim() && !data && !loading && !autoLoaded.current) {
      autoLoaded.current = true;
      fetchPrices({ state, crop });
    }
  }, [crop, data, fetchPrices, loading, state]);

  function selectRow(record: MarketRecord, index: number) {
    const nextDate = toDateInput(record.arrival_date);
    setCrop(record.commodity);
    setState(record.state);
    setMarket(record.market);
    setSelectedDate(nextDate);
    setSelectedRowKey(`${record.commodity}-${record.market}-${record.arrival_date}-${index}`);
    fetchPrices({ crop: record.commodity, state: record.state, market: record.market, selectedDate: nextDate });
  }

  const markets = useMemo(() => {
    return options.markets.length
      ? options.markets
      : Array.from(new Set((data?.records ?? []).map((item) => item.market))).filter(Boolean).slice(0, 12);
  }, [data, options.markets]);

  const commodities = useMemo(() => {
    return options.commodities.length
      ? options.commodities
      : Array.from(new Set((data?.records ?? []).map((item) => item.commodity))).filter(Boolean).slice(0, 20);
  }, [data, options.commodities]);

  const trendIcon = data?.trend === "increasing" ? <TrendingUp className="text-green-600" size={18} /> : data?.trend === "decreasing" ? <TrendingDown className="text-red-600" size={18} /> : null;
  const loadedData = data && data.records.length > 0 ? data : null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-blue">Live Mandi Prices</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">Historical mandi market analysis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Analyze real Agmarknet records by state, mandi, commodity, date, attribute, and timeframe.
            </p>
          </div>
          <button
            onClick={() => fetchPrices()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-farm-blue px-5 py-3 font-semibold text-white disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            {loading ? "Refreshing..." : "Refresh Analysis"}
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-4">
          <Field label="State" helper={optionsLoading && !state ? "Loading available states..." : "Selecting a state loads available mandis."}>
            <input className={inputClass} list="mandi-states" placeholder="Example: Punjab" value={state} onChange={(event) => { setState(event.target.value); setMarket(""); setData(null); setError(""); }} />
            <datalist id="mandi-states">
              {options.states.map((item) => <option key={item} value={item} />)}
            </datalist>
          </Field>
          <Field label="Mandi / Market" helper={optionsLoading ? "Loading mandis..." : "Filtered by selected state."}>
            <select
              className={inputClass}
              value={market}
              onChange={(event) => {
                const nextMarket = event.target.value;
                setMarket(nextMarket);
                if (data) fetchPrices({ market: nextMarket });
              }}
            >
              <option value="">All available mandis</option>
              {markets.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Crop / Commodity" helper="Optional. Leave blank to load all live commodities for the selected state/mandi.">
            <input
              className={inputClass}
              list="mandi-commodities"
              placeholder="Example: Wheat, Maize, Cotton"
              value={crop}
              onChange={(event) => {
                setCrop(event.target.value);
                setData(null);
              }}
              onBlur={() => {
                if (data) fetchPrices({ crop });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && data) fetchPrices({ crop });
              }}
            />
            <datalist id="mandi-commodities">
              {commodities.map((item) => <option key={item} value={item} />)}
            </datalist>
          </Field>
          <Field label="Search" helper="Search commodity, market, district, or state.">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input className={`${inputClass} pl-10`} placeholder="Search table" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </Field>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Field label="Date" helper="Blank uses the latest available mandi date. Pick an older date to inspect previous data.">
            <div className="relative">
              <CalendarDays className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input
                className={`${inputClass} pl-10`}
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setSelectedDate(nextDate);
                  if (data) fetchPrices({ selectedDate: nextDate });
                }}
              />
            </div>
          </Field>
          <Field label="Chart Attribute" helper="Click table columns or buttons to chart modal, min, or max price.">
            <div className="grid gap-2 sm:grid-cols-3">
              {attributes.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setPriceAttribute(item.value);
                    if (data) fetchPrices({ priceAttribute: item.value });
                  }}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-bold transition ${
                    priceAttribute === item.value ? "border-farm-blue bg-blue-50 text-farm-blue" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
        {error ? <div className="mt-4"><ErrorPanel message={error} /></div> : null}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
          <p className="font-bold text-farm-blue">Live API Context</p>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <p>Selected state: {state || "Not selected"}</p>
            <p>Selected mandi: {market || "All available mandis in selected state"}</p>
            <p>Selected commodity: {crop || "All available commodities"}</p>
            <p>Timeframe: {timeframe}</p>
            <p>Selected date: {selectedDate || "Latest available date"}</p>
            <p>Source: {data?.api_source || "mandi_price/final_dataset.csv"}</p>
          </div>
        </div>
      </section>

      {loading ? <LoadingSkeleton /> : null}

      {loadedData ? (
        <>
          <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-lg bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Selected market date</p>
              {loadedData.is_prediction ? (
                <p className="mt-2 rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-700">Predicted Market Prices</p>
              ) : null}
              <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">{loadedData.selected_date ?? loadedData.last_updated}</h3>
              <div className="mt-2 flex items-center gap-2 text-sm capitalize text-slate-600">
                Overall trend: {loadedData.is_prediction ? "predicted" : loadedData.history_available ? loadedData.trend : "insufficient history"} {trendIcon}
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="font-semibold text-slate-700">Selected Mandi</p>
                  <p className="font-bold text-farm-blue">{market || "All available mandis"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Historical Average</p>
                  <p className="font-bold text-slate-900">
                    {loadedData.historical_average ? `Rs ${loadedData.historical_average.toLocaleString("en-IN")}` : "Insufficient history"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Moving Average</p>
                  <p className="font-bold text-slate-900">
                    {loadedData.moving_average ? `Rs ${loadedData.moving_average.toLocaleString("en-IN")}` : "Insufficient history"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Volatility</p>
                  <p className="font-bold text-slate-900">
                    {loadedData.volatility ? `Rs ${loadedData.volatility.toLocaleString("en-IN")}` : "Insufficient history"}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{loadedData.records.length} mandi rows loaded for the selected filters.</p>
              {!loadedData.history_available ? (
                <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm font-semibold text-yellow-800">
                  {loadedData.history_message ?? "Insufficient historical mandi data available for trend analysis."}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">Latest source date: {loadedData.last_updated}</p>
            </article>
            <div>
              <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Historical Price Trend</h3>
                  <p className="mt-1 text-sm text-slate-500">Range selector appears after real chart data loads.</p>
                </div>
                {loadedData.history_available ? (
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                    {timeframes.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => {
                          setTimeframe(item.value);
                          fetchPrices({ timeframe: item.value });
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                          timeframe === item.value ? "border-farm-blue bg-blue-50 text-farm-blue" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block font-bold">{item.label}</span>
                        <span>{item.helper}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {loadedData.history_available ? (
                timeframe === "weekly" ? <LineTrendChart data={loadedData.price_trend} color="#1E3A8A" /> : <TrendChart data={loadedData.price_trend} color="#1E3A8A" />
              ) : (
                <EmptyState title="Insufficient historical data" body={loadedData.history_message ?? "Agmarknet did not return enough historical records for these filters."} />
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg bg-white shadow-soft">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="font-display text-xl font-bold text-slate-900">Price Table</h3>
              <p className="mt-1 text-sm text-slate-500">
                Records match the current state, mandi, commodity, search, and selected date filters. Click a row to make it the selected mandi context.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Commodity</th>
                    <th className="px-4 py-3">Market</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Modal Price</th>
                    <th className="px-4 py-3">Min Price</th>
                    <th className="px-4 py-3">Max Price</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadedData.records.map((record, index) => {
                    const trend = priceTrend(loadedData.records, record);
                    const key = `${record.commodity}-${record.market}-${record.arrival_date}-${index}`;
                    return (
                      <tr
                        key={key}
                        onClick={() => selectRow(record, index)}
                        className={`cursor-pointer hover:bg-blue-50 ${selectedRowKey === key ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">{record.commodity}</td>
                        <td className="px-4 py-3 text-slate-700">{record.market}</td>
                        <td className="px-4 py-3 text-slate-700">{record.state}</td>
                        <td className="px-4 py-3 font-bold text-slate-900" onClick={(event) => { event.stopPropagation(); setPriceAttribute("modal_price"); fetchPrices({ priceAttribute: "modal_price" }); }}>
                          <span className="inline-flex items-center gap-1">
                            Rs {record.modal_price.toLocaleString("en-IN")}
                            {trend === "up" ? <TrendingUp className="text-green-600" size={16} /> : null}
                            {trend === "down" ? <TrendingDown className="text-red-600" size={16} /> : null}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700" onClick={(event) => { event.stopPropagation(); setPriceAttribute("min_price"); fetchPrices({ priceAttribute: "min_price" }); }}>Rs {record.min_price.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-slate-700" onClick={(event) => { event.stopPropagation(); setPriceAttribute("max_price"); fetchPrices({ priceAttribute: "max_price" }); }}>Rs {record.max_price.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-slate-700">{record.arrival_date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : data ? (
        <EmptyState title="No mandi records found" body="No mandi rows matched these filters. Remove the mandi filter or search text and refresh again." />
      ) : (
          <EmptyState title="No mandi prices loaded" body="Choose a state and refresh to load the latest FarmWise mandi dataset rows. Mandi and commodity filters are optional." />
      )}
    </div>
  );
}
