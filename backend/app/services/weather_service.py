from __future__ import annotations

import asyncio
from collections import Counter

from app.config import get_settings
from app.schemas.common import ChartPoint, WeatherSnapshot
from app.utils.cache import TTLCache
from app.utils.http import ExternalServiceError, get_json

_cache: TTLCache[WeatherSnapshot] = TTLCache()


class WeatherService:
    def __init__(self) -> None:
        self.settings = get_settings()
    def fallback_weather(self, state: str | None = None) -> WeatherSnapshot:
        key = (state or "").strip().lower()
        defaults = {
            "punjab": (31.0, 48.0, 4.0, "seasonal dry weather"),
            "rajasthan": (35.0, 34.0, 1.0, "hot dry weather"),
            "kerala": (29.0, 78.0, 18.0, "humid coastal weather"),
            "karnataka": (28.0, 62.0, 6.0, "partly cloudy"),
            "tamil nadu": (31.0, 67.0, 5.0, "warm humid weather"),
        }
        temperature, humidity, rainfall, condition = defaults.get(key, (29.0, 60.0, 4.0, "weather estimate"))
        return WeatherSnapshot(
            temperature=temperature,
            humidity=humidity,
            rainfall=rainfall,
            condition=condition,
            wind_speed=3.5,
            rainfall_period="regional fallback estimate",
            forecast_summary="Live OpenWeather data was unavailable, so FarmWise used a regional fallback estimate.",
            anomalies=[],
        )

    async def get_weather(self, lat: float, lon: float) -> WeatherSnapshot:
        if not self.settings.openweather_api_key:
            raise ExternalServiceError("OPENWEATHER_API_KEY is required for live weather data")

        key = f"{lat:.4f}:{lon:.4f}"
        cached = _cache.get(key)
        if cached:
            return cached

        payload = await get_json(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "lat": lat,
                "lon": lon,
                "appid": self.settings.openweather_api_key,
                "units": "metric",
            },
            timeout=self.settings.http_timeout_seconds,
        )
        rain = payload.get("rain") or {}
        weather = payload.get("weather") or [{}]
        observed_rainfall = float(rain.get("1h") or rain.get("3h") or 0)
        rainfall = observed_rainfall
        rainfall_period = "last 1-3 hours"
        forecast_summary = None
        anomalies: list[str] = []
        try:
            forecast_payload = await asyncio.wait_for(
                get_json(
                    "https://api.openweathermap.org/data/2.5/forecast",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self.settings.openweather_api_key,
                        "units": "metric",
                    },
                    timeout=min(self.settings.http_timeout_seconds, 2.0),
                ),
                timeout=2.5,
            )
            forecast_items = forecast_payload.get("list", [])[:8]
            forecast_rainfall = sum(float((item.get("rain") or {}).get("3h") or 0) for item in forecast_items)
            conditions = [
                str(((item.get("weather") or [{}])[0]).get("description") or "unknown")
                for item in forecast_items
            ]
            common_condition = Counter(conditions).most_common(1)[0][0] if conditions else "unknown"
            forecast_summary = f"Next 24h forecast: {forecast_rainfall:.1f} mm expected, mostly {common_condition}."
            if observed_rainfall <= 0 and forecast_rainfall > 0:
                rainfall = forecast_rainfall
                rainfall_period = "next 24 hours forecast"
        except (ExternalServiceError, TimeoutError):
            forecast_summary = "Forecast summary unavailable from OpenWeather."

        temperature = float(payload.get("main", {}).get("temp", 0))
        humidity = float(payload.get("main", {}).get("humidity", 0))
        wind_speed = float(payload.get("wind", {}).get("speed", 0))
        if temperature >= 38:
            anomalies.append("heat stress anomaly")
        if rainfall >= 60:
            anomalies.append("heavy rainfall anomaly")
        if rainfall <= 1 and humidity < 45:
            anomalies.append("dry weather anomaly")
        if humidity >= 88:
            anomalies.append("high humidity disease-pressure anomaly")
        if wind_speed >= 11:
            anomalies.append("high wind anomaly")
        snapshot = WeatherSnapshot(
            temperature=temperature,
            humidity=humidity,
            rainfall=rainfall,
            condition=str(weather[0].get("description") or "unknown"),
            wind_speed=wind_speed,
            rainfall_period=rainfall_period,
            forecast_summary=forecast_summary,
            anomalies=anomalies,
        )
        _cache.set(key, snapshot, self.settings.weather_cache_seconds)
        return snapshot

    def weather_chart(self, weather: WeatherSnapshot) -> list[ChartPoint]:
        return [
            ChartPoint(label="Temperature", value=weather.temperature),
            ChartPoint(label="Humidity", value=weather.humidity),
            ChartPoint(label="Rainfall", value=weather.rainfall),
            ChartPoint(label="Wind", value=weather.wind_speed),
        ]


