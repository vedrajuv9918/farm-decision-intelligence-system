import { CheckCircle2, Leaf, MapPin } from "lucide-react";
import { useState } from "react";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { Field, inputClass } from "../components/ui";
import { updateFarmProfileStatus } from "../services/api";
import type { Location } from "../types/api";

type FarmProfile = {
  farmName: string;
  location: Location | null;
  state: string;
  district: string;
  farmSize: string;
  soilType: string;
  primaryCrop: string;
  irrigationType: string;
};

export function FarmProfileSetup({ navigate, onProfileSaved }: { navigate: (path: string) => void; onProfileSaved?: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<FarmProfile>({
    farmName: "",
    location: null,
    state: "",
    district: "",
    farmSize: "",
    soilType: "Loamy",
    primaryCrop: "Rice",
    irrigationType: "Drip irrigation"
  });

  async function save() {
    if (!profile.farmName || !profile.location || !profile.state || !profile.district || Number(profile.farmSize) <= 0) {
      setError("Complete farm name, location, state, district, and farm size.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const farmId = Date.now().toString();
      const farmWithId = { ...profile, id: farmId };
      localStorage.setItem("farmwise_profile", JSON.stringify(farmWithId));
      localStorage.setItem("farmwise_farms", JSON.stringify([farmWithId]));

      const session = JSON.parse(localStorage.getItem("farmwise_session") || "{}") as { email?: string };
      if (session.email) {
        const response = await updateFarmProfileStatus({ email: session.email, has_farm_profile: true });
        if (response.user) {
          localStorage.setItem("farmwise_user", JSON.stringify(response.user));
        }
      }
      onProfileSaved?.();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save farm profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-farm-bg px-5 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-lg bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-farm-green p-2 text-white">
                  <Leaf size={22} />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-slate-900">FarmWise</p>
                  <p className="text-xs text-slate-500">Smart Farming Decisions Powered by AI & Real-Time Data</p>
                </div>
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-green">First-time setup</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">Create Farm Profile</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">This setup appears only once after first login.</p>
            </div>
            <div className="grid min-w-64 gap-2">
              {["Account created", "Farm profile", "Dashboard ready"].map((step, index) => (
                <div key={step} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 size={18} className={index <= 1 ? "text-farm-green" : "text-slate-300"} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-white p-6 shadow-soft">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Farm Name">
              <input className={inputClass} placeholder="Example: Green Valley Farm" value={profile.farmName} onChange={(event) => setProfile({ ...profile, farmName: event.target.value })} />
            </Field>
            <Field label="Farm Location" helper="Search any Indian village, taluk, district, or city.">
              <LocationAutocomplete
                value={profile.location}
                onChange={(location) =>
                  setProfile({
                    ...profile,
                    location,
                    state: location?.state ?? profile.state,
                    district: location?.district ?? profile.district
                  })
                }
                label="Search location"
              />
            </Field>
            <Field label="State">
              <input className={inputClass} placeholder="Example: Karnataka" value={profile.state} onChange={(event) => setProfile({ ...profile, state: event.target.value })} />
            </Field>
            <Field label="District">
              <input className={inputClass} placeholder="Example: Bengaluru Urban" value={profile.district} onChange={(event) => setProfile({ ...profile, district: event.target.value })} />
            </Field>
            <Field label="Farm Size" helper="Enter total cultivable area in acres.">
              <input className={inputClass} type="number" min="0.1" placeholder="Example: 4.5" value={profile.farmSize} onChange={(event) => setProfile({ ...profile, farmSize: event.target.value })} />
            </Field>
            <Field label="Soil Type">
              <input className={inputClass} placeholder="Example: Loamy soil" value={profile.soilType} onChange={(event) => setProfile({ ...profile, soilType: event.target.value })} />
            </Field>
            <Field label="Primary Crop">
              <input className={inputClass} placeholder="Example: Rice" value={profile.primaryCrop} onChange={(event) => setProfile({ ...profile, primaryCrop: event.target.value })} />
            </Field>
            <Field label="Irrigation Type">
              <select className={inputClass} value={profile.irrigationType} onChange={(event) => setProfile({ ...profile, irrigationType: event.target.value })}>
                <option>Drip irrigation</option>
                <option>Sprinkler irrigation</option>
                <option>Canal irrigation</option>
                <option>Borewell irrigation</option>
                <option>Rainfed</option>
              </select>
            </Field>
          </div>
          {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
          <button
            onClick={save}
            disabled={saving}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-farm-green px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            <MapPin size={18} />
            {saving ? "Saving Profile..." : "Save Farm Profile"}
          </button>
        </section>
      </div>
    </div>
  );
}
