import { AlertTriangle, ArrowRight, CloudSun, LineChart, MapPin, Sprout, Coins, Leaf, Plus, Trash2, Edit2, CheckCircle2, Save, X, UserRound, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { Field, inputClass } from "../components/ui";
import { cropDecision, marketDecision, updateFarmProfileStatus } from "../services/api";
import type { CropDecisionResponse, Location, MarketDecisionResponse } from "../types/api";

type Props = {
  navigate: (path: string) => void;
  onProfileUpdated?: () => void;
  cropData: CropDecisionResponse | null;
  marketData: MarketDecisionResponse | null;
  cropMetadata?: { status: "Live" | "Cached" | "No Data"; timestamp: string | null };
  marketMetadata?: { status: "Live" | "Cached" | "No Data"; timestamp: string | null };
  setCropData: (data: CropDecisionResponse | null) => void;
  setMarketData: (data: MarketDecisionResponse | null) => void;
};

type FarmProfile = {
  id: string;
  farmName: string;
  location: Location | null;
  state: string;
  district: string;
  farmSize: string;
  soilType: string;
  primaryCrop: string;
  irrigationType: string;
};

const defaultDashboardLocation: Location = {
  label: "Karnataka, India",
  lat: 15.3173,
  lon: 75.7139,
  state: "Karnataka",
  district: "Karnataka"
};

const stateCoordinates: Record<string, { lat: number; lon: number }> = {
  "andhra pradesh": { lat: 15.9129, lon: 79.7400 },
  "arunachal pradesh": { lat: 28.2180, lon: 94.7278 },
  "assam": { lat: 26.2006, lon: 92.9376 },
  "bihar": { lat: 25.0961, lon: 85.3131 },
  "chhattisgarh": { lat: 21.2787, lon: 81.8661 },
  "goa": { lat: 15.2993, lon: 74.1240 },
  "gujarat": { lat: 22.2587, lon: 71.1924 },
  "haryana": { lat: 29.0588, lon: 76.0856 },
  "himachal pradesh": { lat: 31.1048, lon: 77.1734 },
  "jharkhand": { lat: 23.6102, lon: 85.2799 },
  "karnataka": { lat: 15.3173, lon: 75.7139 },
  "kerala": { lat: 10.8505, lon: 76.2711 },
  "madhya pradesh": { lat: 22.9734, lon: 78.6569 },
  "maharashtra": { lat: 19.7515, lon: 75.7139 },
  "manipur": { lat: 24.6637, lon: 93.9063 },
  "meghalaya": { lat: 25.4670, lon: 91.3662 },
  "mizoram": { lat: 23.1645, lon: 92.9376 },
  "nagaland": { lat: 26.1584, lon: 94.5624 },
  "odisha": { lat: 20.9517, lon: 85.0985 },
  "punjab": { lat: 31.1471, lon: 75.3412 },
  "rajasthan": { lat: 27.0238, lon: 74.2179 },
  "sikkim": { lat: 27.5330, lon: 88.5122 },
  "tamil nadu": { lat: 11.1271, lon: 78.6569 },
  "telangana": { lat: 18.1124, lon: 79.0193 },
  "tripura": { lat: 23.9408, lon: 91.9882 },
  "uttar pradesh": { lat: 26.8467, lon: 80.9462 },
  "uttarakhand": { lat: 30.0668, lon: 79.0193 },
  "west bengal": { lat: 22.9868, lon: 87.8550 }
};

function currentIndianSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 6 && month <= 10) return "Kharif";
  if (month === 3 || month === 4 || month === 5) return "Zaid";
  return "Rabi";
}

const defaultEmptyFarm = (): FarmProfile => ({
  id: "",
  farmName: "",
  location: null,
  state: "",
  district: "",
  farmSize: "",
  soilType: "Loamy",
  primaryCrop: "",
  irrigationType: "Drip irrigation"
});

export function DashboardOverview({
  navigate,
  onProfileUpdated,
  cropData,
  marketData,
  cropMetadata,
  marketMetadata,
  setCropData,
  setMarketData
}: Props) {
  const user = JSON.parse(
    localStorage.getItem("farmwise_user") ||
    "{\"full_name\":\"FarmWise User\",\"email\":\"farmer@example.com\"}"
  );

  // Load farms from local storage.
  const [farms, setFarms] = useState<FarmProfile[]>(() => {
    try {
      const storedFarms = localStorage.getItem("farmwise_farms");
      if (storedFarms) {
        return JSON.parse(storedFarms);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activeFarmId, setActiveFarmId] = useState<string>(() => {
    try {
      const activeStr = localStorage.getItem("farmwise_profile");
      if (activeStr) {
        const active = JSON.parse(activeStr);
        return active?.id || "";
      }
    } catch {
      // Ignored
    }
    return farms[0]?.id || "";
  });

  const activeFarm = useMemo(() => farms.find((f) => f.id === activeFarmId) || farms[0] || null, [farms, activeFarmId]);

  const profileLocation = useMemo<Location>(() => {
    if (activeFarm?.location) {
      return {
        ...activeFarm.location,
        state: activeFarm.location.state || activeFarm.state || null,
        district: activeFarm.location.district || activeFarm.district || null
      };
    }
    if (activeFarm?.state) {
      const stateKey = activeFarm.state.trim().toLowerCase();
      const coords = stateCoordinates[stateKey] || stateCoordinates["karnataka"];
      return {
        label: `${activeFarm.district || ""}, ${activeFarm.state}, India`,
        lat: coords.lat,
        lon: coords.lon,
        state: activeFarm.state,
        district: activeFarm.district || null
      };
    }
    return defaultDashboardLocation;
  }, [activeFarm]);

  const primaryCrop = activeFarm?.primaryCrop?.trim() || "Rice";
  const soilType = activeFarm?.soilType?.trim() || "Loamy";
  const season = currentIndianSeason();

  // State to control farm editing/adding form inline
  const [isEditing, setIsEditing] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmProfile>(defaultEmptyFarm());
  
  const [loading, setLoading] = useState({ weather: false, market: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Automatically refresh weather & market price feed for the active farm in the background
  useEffect(() => {
    let cancelled = false;
    if (!profileLocation || !primaryCrop || isEditing) return;

    // 1. Fetch weather signals
    if (!cropData && !loading.weather) {
      setLoading((current) => ({ ...current, weather: true }));
      cropDecision({ location: profileLocation, soil_type: soilType, season })
        .then((data) => {
          if (!cancelled) setCropData(data);
        })
        .catch(() => {
          // Silent fallback on background load
        })
        .finally(() => {
          if (!cancelled) setLoading((current) => ({ ...current, weather: false }));
        });
    }

    // 2. Fetch mandi market prices for active farm's crop
    if (!marketData && !loading.market) {
      setLoading((current) => ({ ...current, market: true }));
      marketDecision({ crop: primaryCrop, location: profileLocation, timeframe: "monthly" })
        .then((data) => {
          if (!cancelled) setMarketData(data);
        })
        .catch(() => {
          // Silent fallback on background load
        })
        .finally(() => {
          if (!cancelled) setLoading((current) => ({ ...current, market: false }));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeFarm?.id, cropData, marketData, primaryCrop, profileLocation, season, soilType, isEditing]);

  // Handle switching active farm
  function handleSetActive(farmId: string) {
    const selectedFarm = farms.find((f) => f.id === farmId);
    if (!selectedFarm) return;
    try {
      setActiveFarmId(farmId);
      localStorage.setItem("farmwise_profile", JSON.stringify(selectedFarm));
      onProfileUpdated?.();
      setMessage(`"${selectedFarm.farmName}" is now the active farm.`);
      setError("");
      setTimeout(() => setMessage(""), 4000);
    } catch {
      setError("Failed to select active farm.");
    }
  }

  // Handle delete farm
  function handleDeleteFarm(farmId: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this farm location?")) return;

    const remainingFarms = farms.filter((f) => f.id !== farmId);
    setFarms(remainingFarms);
    localStorage.setItem("farmwise_farms", JSON.stringify(remainingFarms));

    if (activeFarmId === farmId) {
      if (remainingFarms.length > 0) {
        const nextActive = remainingFarms[0];
        setActiveFarmId(nextActive.id);
        localStorage.setItem("farmwise_profile", JSON.stringify(nextActive));
      } else {
        setActiveFarmId("");
        localStorage.removeItem("farmwise_profile");
      }
      onProfileUpdated?.();
    }
    setMessage("Farm location removed.");
    setTimeout(() => setMessage(""), 4000);
  }

  // Open add farm form
  function handleOpenAddForm() {
    setEditingFarm({
      ...defaultEmptyFarm(),
      id: Date.now().toString()
    });
    setError("");
    setMessage("");
    setIsEditing(true);
  }

  // Open edit farm form
  function handleOpenEditForm(farm: FarmProfile, event: React.MouseEvent) {
    event.stopPropagation();
    setEditingFarm({ ...farm });
    setError("");
    setMessage("");
    setIsEditing(true);
  }

  // Save add/edit farm form
  async function handleSaveFarm() {
    if (
      !editingFarm.farmName.trim() ||
      !editingFarm.state.trim() ||
      !editingFarm.district.trim() ||
      !editingFarm.primaryCrop.trim() ||
      Number(editingFarm.farmSize) <= 0
    ) {
      setError("Farm name, state, district, size (> 0), and primary crop are required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      let updatedFarms = [...farms];
      const existingIndex = farms.findIndex((f) => f.id === editingFarm.id);
      
      if (existingIndex > -1) {
        updatedFarms[existingIndex] = editingFarm;
      } else {
        updatedFarms.push(editingFarm);
      }

      setFarms(updatedFarms);
      localStorage.setItem("farmwise_farms", JSON.stringify(updatedFarms));

      // Sync active farm profile if needed
      if (activeFarmId === editingFarm.id || updatedFarms.length === 1) {
        setActiveFarmId(editingFarm.id);
        localStorage.setItem("farmwise_profile", JSON.stringify(editingFarm));
        
        const session = JSON.parse(localStorage.getItem("farmwise_session") || "{}") as { email?: string };
        if (session.email) {
          const response = await updateFarmProfileStatus({ email: session.email, has_farm_profile: true });
          if (response.user) {
            localStorage.setItem("farmwise_user", JSON.stringify(response.user));
          }
        }
        
        onProfileUpdated?.();
      }

      setIsEditing(false);
      setMessage("Farm locations updated.");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save farm details.");
    } finally {
      setSaving(false);
    }
  }

  // Extract weather metrics
  const weather = cropData?.weather || null;

  if (isEditing) {
    /* ==================== FORM MODE ==================== */
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft space-y-6 animate-landing-fade-in">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900">
              {farms.some((f) => f.id === editingFarm.id) ? "Edit Farm Location" : "Add Farm Location"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Specify crop, soil type, location coordinates, and size</p>
          </div>
          <button 
            onClick={() => setIsEditing(false)} 
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Farm Name">
            <input
              className={inputClass}
              placeholder="Example: Green Valley Farm"
              value={editingFarm.farmName}
              onChange={(event) => setEditingFarm({ ...editingFarm, farmName: event.target.value })}
            />
          </Field>
          <Field label="Farm Location" helper="Search location to set coordinates, state, and district automatically.">
            <LocationAutocomplete
              value={editingFarm.location}
              onChange={(location) =>
                setEditingFarm({
                  ...editingFarm,
                  location,
                  state: location?.state ?? editingFarm.state,
                  district: location?.district ?? editingFarm.district
                })
              }
              label="Search location"
            />
          </Field>
          <Field label="State">
            <input
              className={inputClass}
              placeholder="Example: Punjab"
              value={editingFarm.state}
              onChange={(event) => setEditingFarm({ ...editingFarm, state: event.target.value })}
            />
          </Field>
          <Field label="District">
            <input
              className={inputClass}
              placeholder="Example: Mohali"
              value={editingFarm.district}
              onChange={(event) => setEditingFarm({ ...editingFarm, district: event.target.value })}
            />
          </Field>
          <Field label="Farm Size (acres)" helper="Total cultivable area in acres.">
            <input
              className={inputClass}
              type="number"
              min="0.1"
              step="0.1"
              placeholder="Example: 4.5"
              value={editingFarm.farmSize}
              onChange={(event) => setEditingFarm({ ...editingFarm, farmSize: event.target.value })}
            />
          </Field>
          <Field label="Soil Type">
            <input
              className={inputClass}
              placeholder="Example: Loamy, Clay, Laterite"
              value={editingFarm.soilType}
              onChange={(event) => setEditingFarm({ ...editingFarm, soilType: event.target.value })}
            />
          </Field>
          <Field label="Primary Crop">
            <input
              className={inputClass}
              placeholder="Example: Rice, Wheat, Cotton"
              value={editingFarm.primaryCrop}
              onChange={(event) => setEditingFarm({ ...editingFarm, primaryCrop: event.target.value })}
            />
          </Field>
          <Field label="Irrigation Type">
            <select
              className={inputClass}
              value={editingFarm.irrigationType}
              onChange={(event) => setEditingFarm({ ...editingFarm, irrigationType: event.target.value })}
            >
              <option>Drip irrigation</option>
              <option>Sprinkler irrigation</option>
              <option>Canal irrigation</option>
              <option>Borewell irrigation</option>
              <option>Rainfed</option>
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveFarm}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-farm-green px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-green-800 disabled:opacity-75"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Farm"}
          </button>
        </div>
      </section>
    );
  }

  /* ==================== HOME / PROFILE VIEW MODE ==================== */
  return (
    <div className="space-y-6">
      
      {/* 2. Unified Hero Section */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200/50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-farm-green">
                <Leaf size={14} className="rotate-12" /> Farmer: {user.full_name || "FarmWise Farmer"}
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900">
                {activeFarm?.farmName || "Add a Farm Location to Start"}
              </h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-8 gap-y-4 text-sm border-t border-slate-100 pt-4">
              <div>
                <span className="font-semibold text-slate-400 block uppercase text-[10px] tracking-wider">Location</span>
                <span className="text-slate-800 font-bold block mt-0.5">{profileLocation.label}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block uppercase text-[10px] tracking-wider">Season</span>
                <span className="text-slate-800 font-bold block mt-0.5">{season}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block uppercase text-[10px] tracking-wider">Primary Crop</span>
                <span className="text-slate-800 font-bold block mt-0.5">{primaryCrop}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block uppercase text-[10px] tracking-wider">Soil Type</span>
                <span className="text-slate-800 font-bold block mt-0.5">{soilType}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block uppercase text-[10px] tracking-wider">Farm Size</span>
                <span className="text-slate-800 font-bold block mt-0.5">{activeFarm ? `${activeFarm.farmSize} Acres` : "0 Acres"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 self-stretch lg:self-start shrink-0">
            {farms.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/40 rounded-xl px-3 py-2 text-sm shadow-soft">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">
                  Active Farm:
                </span>
                <select
                  value={activeFarm?.id || ""}
                  onChange={(e) => handleSetActive(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-sm"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.farmName} ({f.district})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={handleOpenAddForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-farm-green px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-green-800"
            >
              <Plus size={16} />
              Add New Farm
            </button>
          </div>
        </div>
        {message ? <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-farm-green transition-all duration-300">{message}</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-all duration-300">{error}</p> : null}
      </section>

      {/* 3. Live Farm Summary (Only display populated information) */}
      <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">Live Farm Summary</h3>
      <div className="grid gap-5 md:grid-cols-3">
        
        {/* Weather Card */}
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Weather Card</span>
              <span className="text-farm-green"><CloudSun size={20} /></span>
            </div>
            {weather ? (
              <div className="mt-4 space-y-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900">{weather.temperature.toFixed(1)}°C</p>
                <div className="text-xs text-slate-500 font-semibold space-y-0.5">
                  <p className="capitalize text-slate-700 font-bold">{weather.condition}</p>
                  <p>Humidity: {weather.humidity}%</p>
                  <p>Wind: {weather.wind_speed} m/s</p>
                  {weather.rainfall > 0 && <p>Rainfall: {weather.rainfall.toFixed(1)} mm</p>}
                </div>
              </div>
            ) : (
              <div className="mt-4 py-4 text-center">
                <p className="text-xs font-bold text-slate-400">Live weather did not respond yet.</p>
                <p className="text-[10px] text-slate-400 mt-1">Select location or verify coordinates in profile to sync.</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className={cropMetadata?.status === "Live" ? "text-green-600" : "text-blue-500"}>
              {cropMetadata?.status || "No Data"}
            </span>
            {cropMetadata?.timestamp && <span>{cropMetadata.timestamp}</span>}
          </div>
        </article>

        {/* Current Crop Card */}
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Crop</span>
              <span className="text-farm-green"><Sprout size={20} /></span>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-3xl font-bold tracking-tight text-slate-900">{primaryCrop}</p>
              <div className="text-xs text-slate-500 font-semibold space-y-0.5">
                <p>Season: {season}</p>
                <p>Soil Type: {soilType}</p>
                <p>Cultivable Size: {activeFarm ? activeFarm.farmSize : 0} Acres</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="text-green-600">Configured</span>
            <span>Profile settings</span>
          </div>
        </article>

        {/* Market Summary Card */}
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Market Summary</span>
              <span className="text-farm-blue"><LineChart size={20} /></span>
            </div>
            {marketData ? (
              <div className="mt-4 space-y-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900 truncate">{marketData.decision}</p>
                <div className="text-xs text-slate-500 font-semibold space-y-0.5">
                  <p>Commodity: {primaryCrop}</p>
                  <p>Mandi: {marketData.best_market}</p>
                  <p>Price: Rs {marketData.selected_modal_price?.toLocaleString("en-IN")}/qtl</p>
                  <p className="capitalize">Trend: {marketData.trend}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 py-4 text-center">
                <p className="text-xs font-bold text-slate-400">No Market summary details.</p>
                <p className="text-[10px] text-slate-400 mt-1">To view mandi price trends, check crop prices first.</p>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <button
              onClick={() => navigate("/market-intelligence")}
              className="text-[10px] font-bold text-farm-blue hover:text-blue-800 flex items-center gap-1"
            >
              Open Market Intelligence ➔
            </button>
            {marketMetadata?.timestamp && <span>{marketMetadata.timestamp}</span>}
          </div>
        </article>

      </div>

      {/* 4. Farm Management & 5. Quick Actions layout */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        
        {/* Left Column: Farm Management List */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display text-xl font-bold text-slate-900">Manage Farm Locations</h3>
            <p className="text-xs text-slate-500 mt-0.5">Switch active farm profiles, modify setup values, or delete locations</p>
          </div>

          {farms.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
              <MapPin className="mx-auto text-slate-300 mb-3" size={32} />
              <p className="text-sm font-semibold text-slate-600">No farm locations registered</p>
              <button
                onClick={handleOpenAddForm}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-farm-green px-4 py-2 text-xs font-bold text-white transition hover:bg-green-800"
              >
                <Plus size={14} /> Add First Farm
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {farms.map((farm) => {
                const isActive = farm.id === activeFarmId;
                return (
                  <div
                    key={farm.id}
                    onClick={() => !isActive && handleSetActive(farm.id)}
                    className={`relative group flex flex-col justify-between p-4 rounded-xl border transition duration-200 ${
                      isActive
                        ? "border-farm-green bg-green-50/10 ring-1 ring-farm-green/35 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-bold text-slate-800">{farm.farmName}</h4>
                          {isActive && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-farm-green">
                              <CheckCircle2 size={9} /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-1 flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          {farm.location?.label || `${farm.district}, ${farm.state}`}
                        </p>
                      </div>

                      {/* Edit/Delete Actions */}
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleOpenEditForm(farm, e)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteFarm(farm.id, e)}
                          className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-[10px] border-t border-slate-100/60 pt-3">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Crop</span>
                        <span className="text-slate-700 font-bold block">{farm.primaryCrop}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Soil</span>
                        <span className="text-slate-700 font-bold block">{farm.soilType}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Acreage</span>
                        <span className="text-slate-700 font-bold block">{farm.farmSize} Ac</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Irrigation</span>
                        <span className="text-slate-700 font-bold block truncate">{farm.irrigationType}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Quick Actions (Replacing placeholders) */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display text-xl font-bold text-slate-900">Intelligence Modules</h3>
            <p className="text-xs text-slate-500 mt-0.5">Quickly navigate to advanced agricultural services</p>
          </div>

          <div className="grid gap-3">
            {[
              { path: "/crop-intelligence", label: "🌱 Crop Intelligence", desc: "Rank crop recommendations, profit, and soil match scores" },
              { path: "/market-intelligence", label: "📈 Market Intelligence", desc: "Assess sell / hold mandi guides and pricing windows" },
              { path: "/mandi-prices", label: "🏪 Live Mandi Prices", desc: "Interact with real-time Agmarknet commodity feeds" },
              { path: "/expense-intelligence", label: "💰 Expense Intelligence", desc: "Audit labor, fertilizer, and irrigation cost baselines" },
              { path: "/risk-intelligence", label: "⚠ Risk Intelligence", desc: "Analyze temperature anomalies, rainfall, and risk alerts" }
            ].map(({ path, label, desc }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-start rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-left transition hover:border-farm-green/30 hover:bg-green-50/15"
              >
                <span className="font-display text-sm font-bold text-slate-800 flex items-center justify-between w-full">
                  {label}
                  <ArrowRight size={14} className="text-slate-400" />
                </span>
                <span className="text-[10px] text-slate-500 mt-1 font-semibold leading-relaxed">{desc}</span>
              </button>
            ))}
          </div>
        </div>

      </section>
    </div>
  );
}
