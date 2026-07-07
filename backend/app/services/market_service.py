from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from dateutil import parser
from dateutil.relativedelta import relativedelta

from app.config import get_settings
from app.schemas.common import ChartPoint, Location, MarketRecord
from app.utils.cache import TTLCache
from app.utils.http import ExternalServiceError, get_json

_current_cache: TTLCache[list[MarketRecord]] = TTLCache()
_historical_cache: TTLCache[list[MarketRecord]] = TTLCache()


class MarketServiceBase:
    def __init__(
        self,
        *,
        api_key: str | None,
        resource_id: str | None,
        cache: TTLCache[list[MarketRecord]],
        cache_seconds: int,
        log_prefix: str,
    ) -> None:
        self.settings = get_settings()
        self.api_key = api_key
        self.resource_id = resource_id
        self._cache = cache
        self.cache_seconds = cache_seconds
        self.log_prefix = log_prefix

    def api_label(self, value: str | None) -> str | None:
        cleaned = (value or "").strip()
        return " ".join(part.capitalize() for part in cleaned.split()) if cleaned else None

    def normalized(self, value: str) -> str:
        text = value.strip().lower()
        replacements = {
            "chilly": "chilli",
            "chilies": "chilli",
            "chillies": "chilli",
            "lady finger": "ladies finger",
            "okra": "bhindi",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        return "".join(char for char in text if char.isalnum())

    def commodity_matches(self, commodity: str, query: str | None) -> bool:
        if not query:
            return True
        commodity_key = self.normalized(commodity)
        query_key = self.normalized(query)
        return query_key in commodity_key or commodity_key in query_key

    def filter_by_commodity_query(self, records: list[MarketRecord], query: str | None) -> list[MarketRecord]:
        if not query:
            return records
        return [record for record in records if self.commodity_matches(record.commodity, query)]

    async def get_prices(self, crop: str, location: Location) -> list[MarketRecord]:
        if not self.api_key:
            raise ExternalServiceError(f"{self.log_prefix} API Key is required for live mandi data")

        state = self.api_label(location.state) or ""
        crop_label = self.api_label(crop) or crop
        key = f"{crop_label.lower()}:{state.lower()}"
        cached = self._cache.get(key)
        if cached:
            return cached

        print(f"{self.log_prefix}\nResource ID: {self.resource_id}")

        params: dict[str, object] = {
            "api-key": self.api_key,
            "format": "json",
            "limit": 1000,
            "filters[commodity]": crop_label,
        }
        if state:
            params["filters[state]"] = state

        payload = await get_json(
            f"https://api.data.gov.in/resource/{self.resource_id}",
            params=params,
            timeout=self.settings.http_timeout_seconds,
        )
        records: list[MarketRecord] = []
        for raw in payload.get("records", []):
            try:
                record = MarketRecord(
                    commodity=str(raw.get("commodity") or crop_label),
                    state=str(raw.get("state") or ""),
                    district=str(raw.get("district") or ""),
                    market=str(raw.get("market") or ""),
                    modal_price=float(raw.get("modal_price") or 0),
                    min_price=float(raw.get("min_price") or 0),
                    max_price=float(raw.get("max_price") or 0),
                    arrival_date=str(raw.get("arrival_date") or ""),
                )
            except (TypeError, ValueError):
                continue
            if record.commodity.lower() != crop_label.lower():
                continue
            if state and record.state.lower() != state.lower():
                continue
            records.append(record)
        if not records:
            raise ExternalServiceError(f"No mandi records found for {crop_label} in {state or 'India'}")
        self._cache.set(key, records, self.cache_seconds)
        return records

    async def get_prices_for_filters(
        self,
        *,
        crop: str | None = None,
        state: str | None = None,
        market: str | None = None,
        search: str | None = None,
        arrival_date: str | None = None,
        limit: int = 1000,
    ) -> list[MarketRecord]:
        if not self.api_key:
            raise ExternalServiceError(f"{self.log_prefix} API Key is required for live mandi data")

        api_crop = self.api_label(crop)
        api_state = self.api_label(state)
        api_market = (market or "").strip() or None
        key = f"filters:{api_crop or ''}:{api_state or ''}:{api_market or ''}:{search or ''}:{arrival_date or ''}:{limit}".lower()
        cached = self._cache.get(key)
        if cached:
            return cached

        print(f"{self.log_prefix}\nResource ID: {self.resource_id}")

        params: dict[str, object] = {
            "api-key": self.api_key,
            "format": "json",
            "limit": limit,
        }
        if api_crop:
            params["filters[commodity]"] = api_crop
        if api_state:
            params["filters[state]"] = api_state
        if api_market:
            params["filters[market]"] = api_market
        if arrival_date:
            params["filters[arrival_date]"] = arrival_date

        payload = await get_json(
            f"https://api.data.gov.in/resource/{self.resource_id}",
            params=params,
            timeout=self.settings.http_timeout_seconds,
        )
        query = (search or "").strip().lower()
        records = []
        for raw in payload.get("records", []):
            try:
                record = MarketRecord(
                    commodity=str(raw.get("commodity") or ""),
                    state=str(raw.get("state") or ""),
                    district=str(raw.get("district") or ""),
                    market=str(raw.get("market") or ""),
                    modal_price=float(raw.get("modal_price") or 0),
                    min_price=float(raw.get("min_price") or 0),
                    max_price=float(raw.get("max_price") or 0),
                    arrival_date=str(raw.get("arrival_date") or ""),
                )
            except (TypeError, ValueError):
                continue
            if api_crop and record.commodity.lower() != api_crop.lower():
                continue
            if api_state and record.state.lower() != api_state.lower():
                continue
            if api_market and record.market.lower() != api_market.lower():
                continue
            haystack = f"{record.commodity} {record.state} {record.district} {record.market}".lower()
            if query and query not in haystack:
                continue
            records.append(record)
        self._cache.set(key, records, self.cache_seconds)
        return records

    async def get_options(
        self,
        *,
        state: str | None = None,
        market: str | None = None,
        crop: str | None = None,
    ) -> tuple[list[str], list[str], list[str]]:
        records = await self.get_prices_for_filters(crop=crop, state=state, market=market, limit=5000)
        states = sorted({record.state for record in records if record.state})
        markets = sorted({record.market for record in records if record.market})
        commodities = sorted({record.commodity for record in records if record.commodity})
        return states, markets, commodities

    async def get_latest_crop_prices(self, *, crops: list[str], state: str | None) -> dict[str, float]:
        prices: dict[str, float] = {}
        location = Location(label=state or "India", lat=0, lon=0, state=state)

        async def fetch_crop_price(crop: str) -> tuple[str, float | None]:
            try:
                records = await asyncio.wait_for(self.get_prices(crop, location), timeout=1.5)
            except (ExternalServiceError, TimeoutError):
                return crop, None
            valid_prices = [record.modal_price for record in records if record.modal_price > 0]
            if valid_prices:
                return crop, sum(valid_prices[:10]) / min(len(valid_prices), 10)
            return crop, None

        results = await asyncio.gather(*(fetch_crop_price(crop) for crop in crops[:8]), return_exceptions=True)
        for result in results:
            if isinstance(result, Exception):
                continue
            crop, price = result
            if price:
                prices[crop.lower()] = price
        return prices

    def last_updated(self, records: list[MarketRecord]) -> str:
        parsed_dates = []
        for record in records:
            try:
                parsed_dates.append(parser.parse(record.arrival_date, dayfirst=True))
            except (ValueError, TypeError):
                continue
        if parsed_dates:
            return max(parsed_dates).strftime("%d %b %Y")
        return datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")

    def latest_record_date(self, records: list[MarketRecord]) -> datetime | None:
        parsed_dates = []
        for record in records:
            try:
                parsed_dates.append(parser.parse(record.arrival_date, dayfirst=True))
            except (ValueError, TypeError):
                continue
        return max(parsed_dates) if parsed_dates else None

    def records_for_date(self, records: list[MarketRecord], selected_date: datetime | None) -> list[MarketRecord]:
        if not selected_date:
            return records
        selected_key = selected_date.strftime("%Y-%m-%d")
        filtered = []
        for record in records:
            try:
                day = parser.parse(record.arrival_date, dayfirst=True).strftime("%Y-%m-%d")
            except (ValueError, TypeError):
                continue
            if day == selected_key:
                filtered.append(record)
        return filtered

    def filter_records(self, records: list[MarketRecord], *, market: str | None = None) -> list[MarketRecord]:
        if not market:
            return records
        return [record for record in records if record.market.lower() == market.lower()]

    def api_date(self, day: datetime) -> str:
        return day.strftime("%d/%m/%Y")

    async def historical_trend(
        self,
        *,
        crop: str | None,
        state: str | None,
        market: str | None,
        selected_date: str | None,
        timeframe: str,
        price_attribute: str,
        latest_records: list[MarketRecord],
    ) -> tuple[str, list[ChartPoint], datetime | None, bool, str | None]:
        end_date = self.resolve_selected_date(selected_date, latest_records)
        if not end_date:
            return "insufficient_data", [], None, False, "No dated mandi records are available for the selected filters."

        timeframe_key = timeframe.lower()
        if timeframe_key not in {"weekly", "monthly", "yearly", "alltime"}:
            timeframe_key = "weekly"

        query_dates = self.history_query_dates(end_date, timeframe_key)
        query_results = await asyncio.gather(
            *[
                self.get_prices_for_filters(
                    crop=crop,
                    state=state,
                    market=market,
                    arrival_date=self.api_date(day),
                    limit=1000,
                )
                for day in query_dates
            ],
            return_exceptions=True,
        )
        date_records: list[tuple[datetime, list[MarketRecord]]] = []
        for day, records in zip(query_dates, query_results, strict=False):
            if isinstance(records, Exception):
                continue
            matching_records = self.records_for_date(records, day)
            if matching_records:
                date_records.append((day, matching_records))

        points = self.aggregate_history(date_records, timeframe_key, price_attribute)
        trend = self.trend_from_points(points)
        unique_source_dates = {day.strftime("%Y-%m-%d") for day, _ in date_records}
        unique_values = {point.value for point in points}
        if len(points) < 2 or len(unique_source_dates) < 2:
            return (
                "insufficient_data",
                [],
                end_date,
                False,
                "Insufficient historical mandi data available for trend analysis. Showing the latest market snapshot only.",
            )
        if len(unique_values) < 2:
            return (
                "insufficient_data",
                [],
                end_date,
                False,
                "Live historical prices show zero variations (flat data). Showing the latest market snapshot only.",
            )
        return trend, points, end_date, True, None

    def resolve_selected_date(self, selected_date: str | None, latest_records: list[MarketRecord]) -> datetime | None:
        if selected_date:
            try:
                return parser.parse(selected_date).replace(hour=0, minute=0, second=0, microsecond=0)
            except (ValueError, TypeError):
                return None
        latest = self.latest_record_date(latest_records)
        if latest:
            return latest.replace(hour=0, minute=0, second=0, microsecond=0)
        return None

    def history_query_dates(self, end_date: datetime, timeframe: str) -> list[datetime]:
        if timeframe == "weekly":
            return [end_date - timedelta(days=offset) for offset in range(6, -1, -1)]
        if timeframe == "monthly":
            return [end_date - timedelta(days=offset) for offset in range(29, -1, -1)]
        if timeframe == "alltime":
            current_year = datetime.now().year
            dates = []
            for y in range(2023, current_year + 1):
                dates.append(datetime(y, 6, 1))
            return dates
        dates = []
        for offset in range(11, -1, -1):
            month_date = end_date - relativedelta(months=offset)
            dates.append(month_date.replace(day=min(end_date.day, 28)))
        return dates

    def aggregate_history(
        self,
        date_records: list[tuple[datetime, list[MarketRecord]]],
        timeframe: str,
        price_attribute: str,
    ) -> list[ChartPoint]:
        buckets: dict[str, list[float]] = defaultdict(list)
        attr = price_attribute if price_attribute in {"modal_price", "min_price", "max_price"} else "modal_price"
        for day, records in date_records:
            prices = [float(getattr(record, attr)) for record in records if float(getattr(record, attr)) > 0]
            if not prices:
                continue
            if timeframe == "weekly":
                label = day.strftime("%d %b")
            elif timeframe == "monthly":
                week_start = day - timedelta(days=day.weekday())
                label = f"Week of {week_start.strftime('%d %b')}"
            elif timeframe == "yearly":
                label = day.strftime("%b %Y")
            elif timeframe == "alltime":
                label = day.strftime("%Y")
            else:
                label = day.strftime("%b %Y")
            buckets[label].extend(prices)
        return [ChartPoint(label=label, value=round(sum(values) / len(values), 2)) for label, values in buckets.items()]

    def trend_from_points(self, points: list[ChartPoint]) -> str:
        if len(points) < 2:
            return "insufficient_data"
        first = points[0].value
        last = points[-1].value
        if first <= 0:
            return "stable"
        if last > first * 1.03:
            return "increasing"
        if last < first * 0.97:
            return "decreasing"
        return "stable"

    def historical_average(self, points: list[ChartPoint]) -> float | None:
        if not points:
            return None
        return round(sum(point.value for point in points) / len(points), 2)

    def analyze_trend(self, records: list[MarketRecord]) -> tuple[str, list[ChartPoint], float | None]:
        by_date: dict[datetime, list[float]] = defaultdict(list)
        for record in records:
            try:
                day = parser.parse(record.arrival_date, dayfirst=True).replace(hour=0, minute=0, second=0, microsecond=0)
            except (ValueError, TypeError):
                continue
            if record.modal_price > 0:
                by_date[day].append(record.modal_price)

        points = [
            ChartPoint(label=day.strftime("%d %b"), value=round(sum(values) / len(values), 2))
            for day, values in sorted(by_date.items())
        ][-10:]
        if not points:
            return "insufficient_data", [], None
        latest = points[-1].value
        prior = points[-4:-1] or points[:-1]
        if not prior:
            return "stable", points, latest
        avg_prior = sum(point.value for point in prior) / len(prior)
        if latest > avg_prior * 1.03:
            return "increasing", points, latest
        if latest < avg_prior * 0.97:
            return "decreasing", points, latest
        return "stable", points, latest

    def best_market(self, records: list[MarketRecord]) -> MarketRecord:
        return max(records, key=lambda item: item.modal_price)


class CurrentMarketService(MarketServiceBase):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            api_key=settings.data_gov_api_key_current or settings.data_gov_api_key,
            resource_id=settings.data_gov_resource_id_current or settings.data_gov_resource_id,
            cache=_current_cache,
            cache_seconds=300,  # 5 minutes fresh cache
            log_prefix="[CURRENT API]",
        )


class HistoricalMarketService(MarketServiceBase):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__(
            api_key=settings.data_gov_api_key_historical or settings.data_gov_api_key,
            resource_id=settings.data_gov_resource_id_historical or settings.data_gov_resource_id,
            cache=_historical_cache,
            cache_seconds=settings.mandi_cache_seconds,  # 6 hours cache
            log_prefix="[HISTORICAL API]",
        )


# Backward compatibility alias
MarketService = CurrentMarketService
