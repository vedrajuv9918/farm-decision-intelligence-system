import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { useEffect, useMemo, useState } from "react";
import { localLocationOptions } from "../data/indianLocations";
import { searchLocations } from "../services/api";
import type { Location } from "../types/api";

type Props = {
  value: Location | null;
  onChange: (location: Location | null) => void;
  label?: string;
  helperText?: string;
};

export function LocationAutocomplete({ value, onChange, label = "Farm location", helperText }: Props) {
  const [input, setInput] = useState(value?.label ?? "");
  const [options, setOptions] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const query = useMemo(() => input.trim(), [input]);

  useEffect(() => {
    if (value?.label && value.label !== input) {
      setInput(value.label);
    }
  }, [value?.label]);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      if (query.length < 2) {
        setOptions([]);
        setErrorText("");
        return;
      }
      setLoading(true);
      setErrorText("");
      try {
        const remote = await searchLocations(query);
        const local = localLocationOptions(query);
        const merged = [...local, ...remote].filter(
          (location, index, all) =>
            index === all.findIndex((item) => item.label === location.label || `${item.lat}:${item.lon}` === `${location.lat}:${location.lon}`)
        );
        setOptions(merged);
      } catch {
        const local = localLocationOptions(query);
        setOptions(local);
        setErrorText(local.length ? "Showing built-in state matches while live location search is unavailable." : "Location search is unavailable. Try typing a state name.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      inputValue={input}
      onInputChange={(_, newInput) => setInput(newInput)}
      options={options}
      loading={loading}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.lat === selected.lat && option.lon === selected.lon}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder="Search Indian village, taluk, district"
          helperText={errorText || helperText}
          error={Boolean(errorText && options.length === 0)}
        />
      )}
    />
  );
}
