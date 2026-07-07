import { CheckCircle2, Edit2, Leaf, MapPin, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import { LocationAutocomplete } from "../components/LocationAutocomplete";
import { Field, inputClass } from "../components/ui";
import { updateFarmProfileStatus } from "../services/api";
import type { Location } from "../types/api";

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

export function ProfilePage({ onProfileUpdated }: { onProfileUpdated?: () => void }) {
  const user = JSON.parse(
    localStorage.getItem("farmwise_user") ||
    "{\"full_name\":\"FarmWise User\",\"email\":\"farmer@example.com\"}"
  );

  // Load farms from local storage. Migrate if old profile format is found.
  const [farms, setFarms] = useState<FarmProfile[]>(() => {
    try {
      const storedFarms = localStorage.getItem("farmwise_farms");
      if (storedFarms) {
        return JSON.parse(storedFarms);
      }
      // Migration fallback:
      const oldProfileStr = localStorage.getItem("farmwise_profile");
      if (oldProfileStr) {
        const oldProfile = JSON.parse(oldProfileStr);
        if (oldProfile && oldProfile.farmName) {
          const migratedFarm: FarmProfile = {
            id: oldProfile.id || Date.now().toString(),
            farmName: oldProfile.farmName,
            location: oldProfile.location || null,
            state: oldProfile.state || "",
            district: oldProfile.district || "",
            farmSize: oldProfile.farmSize || "",
            soilType: oldProfile.soilType || "Loamy",
            primaryCrop: oldProfile.primaryCrop || "",
            irrigationType: oldProfile.irrigationType || "Drip irrigation"
          };
          localStorage.setItem("farmwise_farms", JSON.stringify([migratedFarm]));
          localStorage.setItem("farmwise_profile", JSON.stringify(migratedFarm));
          return [migratedFarm];
        }
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

  // State to control add/edit form visibility
  const [isEditing, setIsEditing] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmProfile>(defaultEmptyFarm());
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Handle switching active farm
  function handleSetActive(farmId: string) {
    const selectedFarm = farms.find((f) => f.id === farmId);
    if (!selectedFarm) return;
    
    try {
      setActiveFarmId(farmId);
      localStorage.setItem("farmwise_profile", JSON.stringify(selectedFarm));
      onProfileUpdated?.();
      setMessage(`"${selectedFarm.farmName}" is now the active farm. Dashboard insights will update.`);
      setError("");
      
      // Auto-clear message after 4 seconds
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError("Failed to select active farm.");
    }
  }

  // Handle delete farm
  function handleDeleteFarm(farmId: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this farm?")) return;

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
    setMessage("Farm location removed successfully.");
    setTimeout(() => setMessage(""), 4000);
  }

  // Open form for adding a new farm
  function handleOpenAddForm() {
    setEditingFarm({
      ...defaultEmptyFarm(),
      id: Date.now().toString()
    });
    setError("");
    setMessage("");
    setIsEditing(true);
  }

  // Open form to edit existing farm
  function handleOpenEditForm(farm: FarmProfile, event: React.MouseEvent) {
    event.stopPropagation();
    setEditingFarm({ ...farm });
    setError("");
    setMessage("");
    setIsEditing(true);
  }

  // Save the add/edit farm form
  async function handleSaveFarm() {
    if (
      !editingFarm.farmName.trim() ||
      !editingFarm.state.trim() ||
      !editingFarm.district.trim() ||
      !editingFarm.primaryCrop.trim() ||
      Number(editingFarm.farmSize) <= 0
    ) {
      setError("Farm name, location coordinates, state, district, farm size (> 0), and primary crop are required.");
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
      // (If this was the active farm being edited, or if this is the only farm)
      if (activeFarmId === editingFarm.id || updatedFarms.length === 1) {
        setActiveFarmId(editingFarm.id);
        localStorage.setItem("farmwise_profile", JSON.stringify(editingFarm));
        
        // Update user status on backend if logged in
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
      setMessage(existingIndex > -1 ? "Farm details updated successfully." : "New farm location added successfully.");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save farm details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner section */}
      <section className="rounded-lg bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2 text-farm-green">
              <UserRound size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-farm-green">Profile Settings</p>
              <h2 className="font-display text-3xl font-bold text-slate-900">Farmer and Farm Profile</h2>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={handleOpenAddForm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-farm-green px-5 py-3 font-semibold text-white shadow-soft transition hover:bg-green-800"
            >
              <Plus size={18} />
              Add New Farm
            </button>
          )}
        </div>
        {message ? <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-farm-green transition-all duration-300">{message}</p> : null}
        {error ? <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-all duration-300">{error}</p> : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        
        {/* Left Side: Farmer Profile (Static Info) */}
        <section className="h-fit rounded-lg bg-white p-6 shadow-soft space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display text-xl font-bold text-slate-900">Farmer Account</h3>
            <p className="text-xs text-slate-500 mt-1">Credentials and account metadata</p>
          </div>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Full Name</dt>
              <dd className="text-slate-800 font-medium text-base mt-0.5">{user.full_name || user.fullName || "FarmWise User"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Email Address</dt>
              <dd className="text-slate-800 font-medium text-base mt-0.5">{user.email || "Not set"}</dd>
            </div>
          </dl>
        </section>

        {/* Right Side: Farm Manager OR Edit Form (Mutually Exclusive) */}
        <div className="space-y-6">
          
          {isEditing ? (
            /* ==================== FORM MODE ==================== */
            <section className="rounded-lg bg-white p-6 shadow-soft space-y-6 animate-landing-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">
                    {farms.some((f) => f.id === editingFarm.id) ? "Edit Farm Location" : "Add Farm Location"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Specify crop, soil type, coordinates, and size</p>
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
          ) : (
            /* ==================== VIEW MODE ==================== */
            <section className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow-soft">
                <h3 className="font-display text-xl font-bold text-slate-900">Manage Farm Locations</h3>
                <p className="text-xs text-slate-500 mt-1">Select the active farm location to perform intelligence queries.</p>
                
                {farms.length === 0 ? (
                  <div className="mt-8 text-center py-10 border border-dashed border-slate-200 rounded-xl">
                    <MapPin className="mx-auto text-slate-300 mb-3" size={32} />
                    <p className="text-slate-600 font-semibold">No farm locations registered</p>
                    <p className="text-xs text-slate-400 mt-1 mb-5">Add your first farm location to begin analyzing crop yields and mandi prices.</p>
                    <button
                      onClick={handleOpenAddForm}
                      className="inline-flex items-center gap-2 rounded-lg bg-farm-green px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
                    >
                      <Plus size={16} /> Add First Farm
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {farms.map((farm) => {
                      const isActive = farm.id === activeFarmId;
                      return (
                        <div
                          key={farm.id}
                          onClick={() => !isActive && handleSetActive(farm.id)}
                          className={`relative group flex flex-col justify-between p-5 rounded-2xl border transition duration-300 ${
                            isActive
                              ? "border-farm-green bg-green-50/10 ring-1 ring-farm-green/50 shadow-md"
                              : "border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm cursor-pointer"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <h4 className="font-display text-lg font-bold text-slate-900">{farm.farmName}</h4>
                                {isActive && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-farm-green">
                                    <CheckCircle2 size={10} /> Active
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 font-medium mt-1 flex items-center gap-1">
                                <MapPin size={14} className="text-slate-400" />
                                {farm.location?.label || `${farm.district}, ${farm.state}`}
                              </p>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                onClick={(e) => handleOpenEditForm(farm, e)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                                title="Edit Farm"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteFarm(farm.id, e)}
                                className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                                title="Delete Farm"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-slate-100/70 pt-4">
                            <div className="bg-slate-50/50 rounded-lg p-2.5 border border-slate-100">
                              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Primary Crop</span>
                              <span className="text-slate-800 font-bold block mt-1">{farm.primaryCrop}</span>
                            </div>
                            <div className="bg-slate-50/50 rounded-lg p-2.5 border border-slate-100">
                              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Soil Type</span>
                              <span className="text-slate-800 font-bold block mt-1">{farm.soilType}</span>
                            </div>
                            <div className="bg-slate-50/50 rounded-lg p-2.5 border border-slate-100">
                              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Size</span>
                              <span className="text-slate-800 font-bold block mt-1">{farm.farmSize} Acres</span>
                            </div>
                            <div className="bg-slate-50/50 rounded-lg p-2.5 border border-slate-100">
                              <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[9px]">Irrigation</span>
                              <span className="text-slate-800 font-bold block mt-1">{farm.irrigationType}</span>
                            </div>
                          </div>

                          {!isActive && (
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetActive(farm.id);
                                }}
                                className="text-xs font-bold text-farm-green hover:text-green-800 transition"
                              >
                                Set as Active Farm
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

        </div>

      </div>
    </div>
  );
}
