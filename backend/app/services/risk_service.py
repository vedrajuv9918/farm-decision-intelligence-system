from __future__ import annotations

from app.ml.predictor import crop_catalog
from app.schemas.common import WeatherSnapshot


class RiskService:
    def analyze(
        self,
        weather: WeatherSnapshot,
        season: str,
        *,
        crop: str | None = None,
        state: str | None = None,
        soil_type: str | None = None,
    ) -> tuple[str, str, float, list[str]]:
        score = 0.0
        factors: list[str] = []
        season_key = season.strip().lower()
        crop_key = (crop or "").strip().lower()
        state_key = (state or "").strip().lower()
        soil_key = (soil_type or "").strip().lower()

        crop_rows = None
        if crop_key:
            catalog = crop_catalog()
            crop_rows = catalog[catalog["crop"].str.lower() == crop_key]
            if crop_rows.empty:
                score += 0.12
                factors.append(f"{crop} is not in the local crop suitability catalog, so agronomic risk confidence is limited")
                crop_rows = None

        if crop_rows is not None:
            native_states = sorted({item.strip() for states in crop_rows["states"] for item in str(states).split(",") if item.strip()})
            preferred_seasons = sorted({str(item).strip() for item in crop_rows["season"] if str(item).strip()})
            preferred_soils = sorted({str(item).strip() for item in crop_rows["soil_type"] if str(item).strip()})
            ideal_rainfall = float(crop_rows["rainfall"].median())
            ideal_temperature = float(crop_rows["temperature"].median())
            ideal_humidity = float(crop_rows["humidity"].median())
            annual_crop = any(item.lower() == "annual" for item in preferred_seasons)

            if state_key and not any(item.lower() == state_key for item in native_states):
                score += 0.28
                factors.append(f"{crop} is not a strong regional match for {state}; native regions include {', '.join(native_states[:4])}")
            elif state_key:
                score -= 0.08
                factors.append(f"{crop} is regionally suitable for {state}")

            season_matches = any(item.lower() == season_key for item in preferred_seasons) or any(item.lower() == "annual" for item in preferred_seasons)
            if not season_matches:
                score += 0.22
                factors.append(f"{season} does not match the usual {crop} crop calendar ({', '.join(preferred_seasons)})")
            else:
                score -= 0.06
                factors.append(f"{season} matches the usual {crop} crop calendar")

            if soil_key:
                if not any(item.lower() == soil_key for item in preferred_soils):
                    score += 0.16
                    factors.append(f"{soil_type} soil is not the preferred soil for {crop}; preferred soils include {', '.join(preferred_soils)}")
                else:
                    score -= 0.05
                    factors.append(f"{soil_type} soil is compatible with {crop}")
            else:
                factors.append("soil compatibility was not provided, so soil risk was not scored")

            rainfall_gap = weather.rainfall - ideal_rainfall
            temp_gap = weather.temperature - ideal_temperature
            humidity_gap = weather.humidity - ideal_humidity
            if annual_crop and weather.rainfall >= 10:
                score -= 0.03
                factors.append(f"recent rainfall is adequate for short-term {crop} moisture needs")
            elif rainfall_gap < -ideal_rainfall * 0.65:
                score += 0.24
                factors.append(f"rainfall is far below the {crop} requirement ({weather.rainfall:.1f} mm vs ideal about {ideal_rainfall:.0f} mm)")
            elif rainfall_gap > ideal_rainfall * 0.8:
                score += 0.2
                factors.append(f"rainfall is above the normal {crop} requirement and may increase waterlogging or disease risk")
            else:
                score -= 0.04
                factors.append(f"rainfall is reasonably aligned with {crop} needs for the current signal")

            if temp_gap > 6:
                score += 0.18
                factors.append(f"temperature is hotter than the normal {crop} range by {temp_gap:.1f} C")
            elif temp_gap < -7:
                score += 0.14
                factors.append(f"temperature is cooler than the normal {crop} range by {abs(temp_gap):.1f} C")

            if humidity_gap > 14:
                score += 0.1
                factors.append(f"humidity is higher than the normal {crop} range, increasing pest and disease pressure")

        if weather.rainfall < 15 and season_key in {"kharif", "monsoon"}:
            penalty = min(0.35, (15 - weather.rainfall) * 0.02)
            score += penalty
            factors.append(f"low rainfall ({weather.rainfall:.0f}mm) during a rainfall-dependent season")
        if weather.rainfall > 60:
            penalty = min(0.3, (weather.rainfall - 60) * 0.005)
            score += penalty
            factors.append(f"excessive recent rainfall ({weather.rainfall:.0f}mm) may affect field operations")
        if weather.temperature > 32:
            penalty = min(0.25, (weather.temperature - 32) * 0.03)
            score += penalty
            factors.append(f"high temperature ({weather.temperature:.1f}C) can increase crop stress")
        if weather.temperature < 15:
            penalty = min(0.2, (15 - weather.temperature) * 0.02)
            score += penalty
            factors.append(f"low temperature ({weather.temperature:.1f}C) may slow growth")
        if weather.humidity > 80:
            penalty = min(0.15, (weather.humidity - 80) * 0.01)
            score += penalty
            factors.append(f"high humidity ({weather.humidity:.0f}%) increases pest and disease pressure")
        if weather.wind_speed > 8:
            penalty = min(0.1, (weather.wind_speed - 8) * 0.015)
            score += penalty
            factors.append(f"high wind speed ({weather.wind_speed:.1f}m/s) may damage standing crops")
        for anomaly in weather.anomalies:
            score += 0.06
            factors.append(anomaly)

        score = max(0.0, min(score, 1.0))
        if score >= 0.55:
            level = "high"
            alert = "High farm risk detected from crop, region, season, and live weather signals"
        elif score >= 0.28:
            level = "medium"
            alert = "Moderate farm risk detected; monitor field conditions and market timing closely"
        else:
            level = "low"
            alert = "Current crop and weather risk is low"

        if not factors:
            factors.append("weather variables are within normal operating range")
        return level, alert, round(score, 2), factors[:8]
