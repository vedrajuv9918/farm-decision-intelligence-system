from __future__ import annotations

from functools import lru_cache

from app.config import get_settings
from app.schemas.common import Location
from app.services.history_service import HistoryService
from app.utils.cache import TTLCache
from app.utils.http import get_json

_cache: TTLCache[list[Location]] = TTLCache()

STATE_CENTERS: list[tuple[str, float, float]] = [
    ("Andhra Pradesh", 15.9129, 79.7400),
    ("Arunachal Pradesh", 28.2180, 94.7278),
    ("Assam", 26.2006, 92.9376),
    ("Bihar", 25.0961, 85.3131),
    ("Chhattisgarh", 21.2787, 81.8661),
    ("Goa", 15.2993, 74.1240),
    ("Gujarat", 22.2587, 71.1924),
    ("Haryana", 29.0588, 76.0856),
    ("Himachal Pradesh", 31.1048, 77.1734),
    ("Jharkhand", 23.6102, 85.2799),
    ("Karnataka", 15.3173, 75.7139),
    ("Kerala", 10.8505, 76.2711),
    ("Madhya Pradesh", 22.9734, 78.6569),
    ("Maharashtra", 19.7515, 75.7139),
    ("Manipur", 24.6637, 93.9063),
    ("Meghalaya", 25.4670, 91.3662),
    ("Mizoram", 23.1645, 92.9376),
    ("Nagaland", 26.1584, 94.5624),
    ("Odisha", 20.9517, 85.0985),
    ("Punjab", 31.1471, 75.3412),
    ("Rajasthan", 27.0238, 74.2179),
    ("Sikkim", 27.5330, 88.5122),
    ("Tamil Nadu", 11.1271, 78.6569),
    ("Telangana", 18.1124, 79.0193),
    ("Tripura", 23.9408, 91.9882),
    ("Uttar Pradesh", 26.8467, 80.9462),
    ("Uttarakhand", 30.0668, 79.0193),
    ("West Bengal", 22.9868, 87.8550),
    ("Delhi", 28.7041, 77.1025),
    ("Jammu and Kashmir", 33.7782, 76.5762),
    ("Ladakh", 34.1526, 77.5771),
    ("Puducherry", 11.9416, 79.8083),
]

STATE_CENTER_MAP = {state.lower(): (state, lat, lon) for state, lat, lon in STATE_CENTERS}


class LocationService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def search(self, query: str) -> list[Location]:
        q = query.strip()
        if len(q) < 2:
            return []
        key = q.lower()
        cached = _cache.get(key)
        if cached:
            return cached

        local_matches = self.local_matches(q)
        if local_matches:
            _cache.set(key, local_matches, self.settings.location_cache_seconds)
            return local_matches
        try:
            payload = await get_json(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": f"{q}, India",
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": 8,
                    "countrycodes": "in",
                },
                timeout=self.settings.http_timeout_seconds,
            )
        except Exception:
            _cache.set(key, local_matches, self.settings.location_cache_seconds)
            return local_matches
        locations = list(local_matches)
        known = {(location.label, location.lat, location.lon) for location in locations}
        for item in payload if isinstance(payload, list) else []:
            address = item.get("address", {})
            location = Location(
                label=item.get("display_name", ""),
                lat=float(item["lat"]),
                lon=float(item["lon"]),
                state=address.get("state"),
                district=address.get("state_district") or address.get("county") or address.get("city"),
            )
            key_tuple = (location.label, location.lat, location.lon)
            if key_tuple not in known:
                locations.append(location)
                known.add(key_tuple)
        _cache.set(key, locations, self.settings.location_cache_seconds)
        return locations

    def local_matches(self, query: str) -> list[Location]:
        q = query.lower()
        matches = []
        for state, lat, lon in STATE_CENTERS:
            if q in state.lower():
                matches.append(Location(label=f"{state}, India", lat=lat, lon=lon, state=state, district=state))
        known = {(item.label, item.state, item.district) for item in matches}
        for location in self.dataset_matches(q):
            key = (location.label, location.state, location.district)
            if key not in known:
                matches.append(location)
                known.add(key)
            if len(matches) >= 8:
                break
        return matches[:8]

    def dataset_matches(self, query: str) -> list[Location]:
        locations = []
        for record in local_dataset_locations():
            haystack = f"{record.label} {record.state or ''} {record.district or ''}".lower()
            if query in haystack:
                locations.append(record)
            if len(locations) >= 12:
                break
        return locations


@lru_cache(maxsize=1)
def local_dataset_locations() -> tuple[Location, ...]:
    try:
        history_service = HistoryService()
        index_path = history_service.dataset_path().with_name("location_index.csv")
        if index_path.exists() and index_path.stat().st_mtime >= history_service.dataset_path().stat().st_mtime:
            df = __import__("pandas").read_csv(index_path)
        else:
            source = history_service.dataset_path()
            df = __import__("pandas").read_csv(
                source,
                usecols=lambda column: column in {"State", "STATE", "District", "District Name", "Market", "Market Name"},
                low_memory=False,
            )
            df = df.rename(
                columns={
                    "STATE": "state",
                    "State": "state",
                    "District Name": "district",
                    "District": "district",
                    "Market Name": "market",
                    "Market": "market",
                }
            )
            df = df[["state", "district", "market"]].dropna().drop_duplicates()
            df.to_csv(index_path, index=False)
    except Exception:
        return tuple()
    if df.empty:
        return tuple()

    locations: list[Location] = []
    seen: set[tuple[str, str, str]] = set()

    districts = df[["state", "district"]].drop_duplicates().sort_values(["state", "district"])
    for row in districts.itertuples(index=False):
        state = str(row.state).strip()
        district = str(row.district).strip()
        if not state or not district:
            continue
        center = STATE_CENTER_MAP.get(state.lower())
        if not center:
            continue
        _, lat, lon = center
        label = f"{district.title()}, {state}, India"
        key = (label.lower(), state.lower(), district.lower())
        if key not in seen:
            locations.append(Location(label=label, lat=lat, lon=lon, state=state, district=district.title()))
            seen.add(key)

    markets = df[["state", "district", "market"]].drop_duplicates().sort_values(["state", "district", "market"])
    for row in markets.itertuples(index=False):
        state = str(row.state).strip()
        district = str(row.district).strip()
        market = str(row.market).strip()
        if not state or not district or not market:
            continue
        center = STATE_CENTER_MAP.get(state.lower())
        if not center:
            continue
        _, lat, lon = center
        label = f"{market.title()} Mandi, {district.title()}, {state}, India"
        key = (label.lower(), state.lower(), district.lower())
        if key not in seen:
            locations.append(Location(label=label, lat=lat, lon=lon, state=state, district=district.title()))
            seen.add(key)

    return tuple(locations)
