from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path

import pandas as pd
from sqlalchemy import func, insert, select

from app.db import SessionLocal
from app.models.records import MandiHistory
from app.schemas.common import ChartPoint, MarketRecord


@dataclass
class HistoryAnalytics:
    trend: str
    points: list[ChartPoint]
    history_available: bool
    history_message: str | None
    historical_average: float | None
    moving_average: float | None
    volatility: float | None
    records: list[MarketRecord]
    forecast_points: list[ChartPoint]
    predicted_price: float | None
    prediction_confidence: float
    forecast_message: str | None


class HistoryService:
    def dataset_path(self) -> Path:
        root = Path(__file__).resolve().parents[3]
        final_path = root / "mandi_price" / "final_dataset.csv"
        if final_path.exists():
            return final_path
        return root / "mandi_price" / "Agriculture_price_dataset.csv"

    def parquet_path(self) -> Path:
        return self.dataset_path().with_suffix(".parquet")

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

    @lru_cache(maxsize=1)
    def dataframe(self) -> pd.DataFrame:
        path = self.dataset_path()
        if not path.exists():
            return pd.DataFrame(
                columns=[
                    "arrival_date",
                    "state",
                    "district",
                    "market",
                    "commodity",
                    "variety",
                    "min_price",
                    "max_price",
                    "modal_price",
                ]
            )
        parquet_path = self.parquet_path()
        if parquet_path.exists() and parquet_path.stat().st_mtime >= path.stat().st_mtime:
            try:
                df = pd.read_parquet(parquet_path)
                df["arrival_date"] = pd.to_datetime(df["arrival_date"], errors="coerce").dt.date
                df["state_key"] = df["state"].str.lower()
                df["market_key"] = df["market"].str.lower()
                df["commodity_key"] = df["commodity"].map(self.normalized)
                return df
            except Exception:
                pass

        required_aliases = {
            "STATE",
            "State",
            "District Name",
            "District",
            "Market Name",
            "Market",
            "Commodity",
            "Variety",
            "Min_Price",
            "Max_Price",
            "Modal_Price",
            "Price Date",
            "Arrival_Date",
        }
        df = pd.read_csv(
            path,
            usecols=lambda column: column in required_aliases,
            low_memory=False,
        )
        df = df.rename(
            columns={
                "STATE": "state",
                "STATE": "state",
                "State": "state",
                "District": "district",
                "District Name": "district",
                "District": "district",
                "Market": "market",
                "Market Name": "market",
                "Market": "market",
                "Commodity": "commodity",
                "Variety": "variety",
                "Min_Price": "min_price",
                "Max_Price": "max_price",
                "Modal_Price": "modal_price",
                "Price Date": "arrival_date",
                "Arrival_Date": "arrival_date",
            }
        )
        if "variety" not in df.columns:
            df["variety"] = ""
        df["arrival_date"] = pd.to_datetime(df["arrival_date"], errors="coerce").dt.date
        for column in ["state", "district", "market", "commodity", "variety"]:
            df[column] = df[column].fillna("").astype(str).str.strip()
        for column in ["min_price", "max_price", "modal_price"]:
            df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0)
        df = df.dropna(subset=["arrival_date"])
        df = df[df["modal_price"] > 0]
        df["state_key"] = df["state"].str.lower()
        df["market_key"] = df["market"].str.lower()
        df["commodity_key"] = df["commodity"].map(self.normalized)
        df = df[
            [
                "arrival_date",
                "state",
                "district",
                "market",
                "commodity",
                "variety",
                "min_price",
                "max_price",
                "modal_price",
                "state_key",
                "market_key",
                "commodity_key",
            ]
        ]
        try:
            parquet_df = df.drop(columns=["state_key", "market_key", "commodity_key"])
            parquet_df.to_parquet(parquet_path, index=False)
        except Exception:
            pass
        return df

    async def ensure_imported(self, chunk_size: int = 5000) -> None:
        """Import CSV into the configured SQL database when the table is empty.

        FarmWise can query the CSV cache directly for local demos, but this method
        supports the requested PostgreSQL `mandi_history` table for production.
        """
        df = self.dataframe()
        if df.empty:
            return
        async with SessionLocal() as session:
            count = await session.scalar(select(func.count()).select_from(MandiHistory))
            if count:
                return
            rows = df[
                [
                    "arrival_date",
                    "state",
                    "district",
                    "market",
                    "commodity",
                    "variety",
                    "min_price",
                    "max_price",
                    "modal_price",
                ]
            ].to_dict(orient="records")
            for start in range(0, len(rows), chunk_size):
                await session.execute(insert(MandiHistory), rows[start : start + chunk_size])
                await session.commit()

    async def db_has_history(self) -> bool:
        try:
            async with SessionLocal() as session:
                count = await session.scalar(select(func.count()).select_from(MandiHistory))
                return bool(count)
        except Exception:
            return False

    async def db_records(
        self,
        *,
        state: str | None = None,
        market: str | None = None,
        commodity: str | None = None,
        end_date: date | None = None,
        days: int | None = None,
        limit: int = 5000,
    ) -> list[MarketRecord]:
        api_state = self.api_label(state)
        api_market = (market or "").strip() or None
        async with SessionLocal() as session:
            stmt = select(MandiHistory)
            if api_state:
                stmt = stmt.where(func.lower(MandiHistory.state) == api_state.lower())
            if api_market:
                stmt = stmt.where(func.lower(MandiHistory.market) == api_market.lower())
            if end_date and days:
                stmt = stmt.where(MandiHistory.arrival_date >= end_date - timedelta(days=days - 1))
                stmt = stmt.where(MandiHistory.arrival_date <= end_date)
            elif end_date:
                stmt = stmt.where(MandiHistory.arrival_date <= end_date)
            stmt = stmt.order_by(MandiHistory.arrival_date.desc()).limit(limit)
            rows = list((await session.scalars(stmt)).all())
        rows = [row for row in rows if self.commodity_matches(row.commodity, commodity)]
        return [
            MarketRecord(
                commodity=row.commodity,
                state=row.state,
                district=row.district,
                market=row.market,
                modal_price=float(row.modal_price),
                min_price=float(row.min_price),
                max_price=float(row.max_price),
                arrival_date=row.arrival_date.strftime("%d/%m/%Y"),
            )
            for row in rows
        ]

    def filter_frame(
        self,
        *,
        state: str | None = None,
        market: str | None = None,
        commodity: str | None = None,
        end_date: date | None = None,
        days: int | None = None,
    ) -> pd.DataFrame:
        parquet_path = self.parquet_path()
        csv_path = self.dataset_path()
        if parquet_path.exists() and parquet_path.stat().st_mtime >= csv_path.stat().st_mtime and (state or market or end_date):
            filters = []
            api_state = self.api_label(state)
            if api_state:
                filters.append(("state", "==", api_state))
            if market:
                filters.append(("market", "==", market.strip()))
            if end_date and days:
                filters.append(("arrival_date", ">=", end_date - timedelta(days=days - 1)))
                filters.append(("arrival_date", "<=", end_date))
            elif end_date:
                filters.append(("arrival_date", "<=", end_date))
            try:
                df = pd.read_parquet(
                    parquet_path,
                    columns=[
                        "arrival_date",
                        "state",
                        "district",
                        "market",
                        "commodity",
                        "variety",
                        "min_price",
                        "max_price",
                        "modal_price",
                    ],
                    filters=filters or None,
                )
                df["arrival_date"] = pd.to_datetime(df["arrival_date"], errors="coerce").dt.date
                for column in ["state", "district", "market", "commodity", "variety"]:
                    df[column] = df[column].fillna("").astype(str).str.strip()
                df["state_key"] = df["state"].str.lower()
                df["market_key"] = df["market"].str.lower()
                df["commodity_key"] = df["commodity"].map(self.normalized)
                if commodity:
                    query_key = self.normalized(commodity)
                    df = df[df["commodity_key"].str.contains(query_key, na=False) | df["commodity_key"].map(lambda value: value in query_key)]
                return df
            except Exception:
                pass

        df = self.dataframe()
        if df.empty:
            return df
        if state:
            state_key = self.api_label(state).lower() if self.api_label(state) else state.lower()
            df = df[df["state_key"] == state_key]
        if market:
            df = df[df["market_key"] == market.strip().lower()]
        if commodity:
            query_key = self.normalized(commodity)
            df = df[df["commodity_key"].str.contains(query_key, na=False) | df["commodity_key"].map(lambda value: value in query_key)]
        if end_date and days:
            start_date = end_date - timedelta(days=days - 1)
            df = df[(df["arrival_date"] >= start_date) & (df["arrival_date"] <= end_date)]
        elif end_date:
            df = df[df["arrival_date"] <= end_date]
        return df

    def frame_to_records(self, df: pd.DataFrame, limit: int = 5000) -> list[MarketRecord]:
        if df.empty:
            return []
        rows = df.sort_values("arrival_date", ascending=False).head(limit)
        return [
            MarketRecord(
                commodity=str(row.commodity),
                state=str(row.state),
                district=str(row.district),
                market=str(row.market),
                modal_price=float(row.modal_price),
                min_price=float(row.min_price),
                max_price=float(row.max_price),
                arrival_date=row.arrival_date.strftime("%d/%m/%Y"),
            )
            for row in rows.itertuples(index=False)
        ]

    async def records(
        self,
        *,
        state: str | None = None,
        market: str | None = None,
        commodity: str | None = None,
        end_date: date | None = None,
        days: int | None = None,
        limit: int = 5000,
    ) -> list[MarketRecord]:
        local_records = self.frame_to_records(
            self.filter_frame(state=state, market=market, commodity=commodity, end_date=end_date, days=days),
            limit=limit,
        )
        if local_records:
            return local_records

        try:
            from app.services.market_service import HistoricalMarketService
            return await HistoricalMarketService().get_prices_for_filters(
                crop=commodity,
                state=state,
                market=market,
                limit=limit
            )
        except Exception:
            return []

    async def options(
        self,
        *,
        state: str | None = None,
        market: str | None = None,
        commodity: str | None = None,
    ) -> tuple[list[str], list[str], list[str]]:
        index_path = self.dataset_path().with_name("location_index.csv")
        if index_path.exists() and not commodity:
            try:
                index_df = pd.read_csv(index_path, low_memory=False)
                if state:
                    state_label = self.api_label(state) or state
                    index_df = index_df[index_df["state"].str.lower() == state_label.lower()]
                if market:
                    index_df = index_df[index_df["market"].str.lower() == market.strip().lower()]
                states = sorted(index_df["state"].dropna().unique().tolist())
                markets = sorted(index_df["market"].dropna().unique().tolist())
                commodities: list[str] = []
                if state:
                    commodity_df = self.filter_frame(state=state, market=market, commodity=None)
                    commodities = sorted(commodity_df["commodity"].dropna().unique().tolist()) if not commodity_df.empty else []
                return states, markets, commodities
            except Exception:
                pass
        df = self.filter_frame(state=state, market=market, commodity=commodity)
        if df.empty:
            return [], [], []
        return (
            sorted(df["state"].dropna().unique().tolist()),
            sorted(df["market"].dropna().unique().tolist()),
            sorted(df["commodity"].dropna().unique().tolist()),
        )

    def latest_date(self, records: list[MarketRecord]) -> date | None:
        parsed = []
        for record in records:
            try:
                parsed.append(datetime.strptime(record.arrival_date, "%d/%m/%Y").date())
            except ValueError:
                continue
        return max(parsed) if parsed else None

    async def analytics(
        self,
        *,
        state: str | None,
        market: str | None,
        commodity: str | None,
        timeframe: str,
        price_attribute: str,
        selected_date: str | None = None,
    ) -> HistoryAnalytics:
        seed_records = await self.records(state=state, market=market, commodity=commodity, limit=20000)
        if not seed_records:
            return HistoryAnalytics(
                trend="insufficient_data",
                points=[],
                history_available=False,
                history_message="No historical mandi records found for the selected filters.",
                historical_average=None,
                moving_average=None,
                volatility=None,
                records=[],
                forecast_points=[],
                predicted_price=None,
                prediction_confidence=0.0,
                forecast_message=None,
            )

        if selected_date:
            try:
                end_date = datetime.strptime(selected_date, "%Y-%m-%d").date()
            except ValueError:
                end_date = self.latest_date(seed_records)
        else:
            end_date = self.latest_date(seed_records)

        timeframe_key = timeframe.lower()
        if timeframe_key not in {"weekly", "monthly", "yearly", "alltime"}:
            timeframe_key = "weekly"
        if timeframe_key == "alltime":
            window_records = await self.records(
                state=state,
                market=market,
                commodity=commodity,
                limit=50000,
            )
        else:
            window_days = 7 if timeframe_key == "weekly" else 31 if timeframe_key == "monthly" else 366
            window_records = await self.records(
                state=state,
                market=market,
                commodity=commodity,
                end_date=end_date,
                days=window_days,
                limit=50000,
            )
        points = self.aggregate(window_records, timeframe_key, price_attribute)
        values = [point.value for point in points]
        if len(points) < 2:
            forecast_points, predicted_price, prediction_confidence, forecast_message = self.forecast_from_records(
                window_records,
                price_attribute,
                history_available=False,
            )
            return HistoryAnalytics(
                trend="insufficient_data",
                points=[],
                history_available=False,
                history_message="Insufficient historical mandi data available for trend analysis. Showing the latest market snapshot only.",
                historical_average=round(sum(values) / len(values), 2) if values else None,
                moving_average=round(sum(values[-3:]) / len(values[-3:]), 2) if values else None,
                volatility=None,
                records=window_records,
                forecast_points=forecast_points,
                predicted_price=predicted_price,
                prediction_confidence=prediction_confidence,
                forecast_message=forecast_message,
            )
        avg = round(sum(values) / len(values), 2)
        moving = round(sum(values[-3:]) / len(values[-3:]), 2)
        variance = sum((value - avg) ** 2 for value in values) / len(values)
        if variance < 0.01:
            forecast_points, predicted_price, prediction_confidence, forecast_message = self.forecast_from_records(
                window_records,
                price_attribute,
                history_available=False,
            )
            return HistoryAnalytics(
                trend="insufficient_data",
                points=[],
                history_available=False,
                history_message="Historical prices show zero variation (flat data). Showing the latest market snapshot only.",
                historical_average=avg,
                moving_average=moving,
                volatility=round(variance**0.5, 2),
                records=window_records,
                forecast_points=forecast_points,
                predicted_price=predicted_price,
                prediction_confidence=prediction_confidence,
                forecast_message=forecast_message,
            )
        forecast_points, predicted_price, prediction_confidence, forecast_message = self.forecast_from_records(
            window_records,
            price_attribute,
            history_available=True,
        )
        return HistoryAnalytics(
            trend=self.trend_from_points(points),
            points=points,
            history_available=True,
            history_message=None,
            historical_average=avg,
            moving_average=moving,
            volatility=round(variance**0.5, 2),
            records=window_records,
            forecast_points=forecast_points,
            predicted_price=predicted_price,
            prediction_confidence=prediction_confidence,
            forecast_message=forecast_message,
        )

    def aggregate(self, records: list[MarketRecord], timeframe: str, price_attribute: str) -> list[ChartPoint]:
        buckets: dict[str, list[float]] = defaultdict(list)
        attr = price_attribute if price_attribute in {"modal_price", "min_price", "max_price"} else "modal_price"
        for record in sorted(records, key=lambda item: datetime.strptime(item.arrival_date, "%d/%m/%Y")):
            try:
                day = datetime.strptime(record.arrival_date, "%d/%m/%Y").date()
            except ValueError:
                continue
            price = float(getattr(record, attr))
            if price <= 0:
                continue
            if timeframe == "weekly":
                label = day.strftime("%d %b")
            elif timeframe == "monthly":
                week_start = day - timedelta(days=day.weekday())
                label = f"Week of {week_start.strftime('%d %b')}"
            elif timeframe == "yearly":
                label = day.replace(day=1).strftime("%b %Y")
            elif timeframe == "alltime":
                label = day.strftime("%Y")
            else:
                label = day.replace(day=1).strftime("%b %Y")
            buckets[label].append(price)
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

    def forecast_from_records(
        self,
        records: list[MarketRecord],
        price_attribute: str,
        *,
        history_available: bool,
    ) -> tuple[list[ChartPoint], float | None, float, str | None]:
        attr = price_attribute if price_attribute in {"modal_price", "min_price", "max_price"} else "modal_price"
        by_day: dict[date, list[float]] = defaultdict(list)
        for record in records:
            try:
                day = datetime.strptime(record.arrival_date, "%d/%m/%Y").date()
            except ValueError:
                continue
            price = float(getattr(record, attr))
            if price > 0:
                by_day[day].append(price)

        daily = [
            (day, sum(values) / len(values))
            for day, values in sorted(by_day.items())
            if values
        ]
        if len(daily) < 5:
            return [], None, 0.18, "Prediction disabled because fewer than 5 historical price days matched this mandi and commodity."

        recent = daily[-21:]
        x_values = list(range(len(recent)))
        y_values = [price for _, price in recent]
        x_mean = sum(x_values) / len(x_values)
        y_mean = sum(y_values) / len(y_values)
        denominator = sum((x - x_mean) ** 2 for x in x_values)
        slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values, strict=False)) / denominator if denominator else 0.0
        intercept = y_mean - slope * x_mean
        residuals = [abs(y - (intercept + slope * x)) for x, y in zip(x_values, y_values, strict=False)]
        mean_error = sum(residuals) / len(residuals)
        latest_day, latest_price = recent[-1]
        confidence = 0.35 + min(len(recent), 21) * 0.02
        if mean_error and y_mean:
            confidence -= min(0.28, mean_error / y_mean)
        if not history_available:
            confidence -= 0.12
        confidence = round(max(0.2, min(0.86, confidence)), 2)

        forecast_points = []
        for offset in range(1, 8):
            predicted = max(0.0, intercept + slope * (len(recent) - 1 + offset))
            day = latest_day + timedelta(days=offset)
            forecast_points.append(ChartPoint(label=day.strftime("%d %b"), value=round(predicted, 2)))
        predicted_price = round(forecast_points[-1].value, 2) if forecast_points else round(latest_price, 2)
        direction = "upward" if predicted_price > latest_price * 1.02 else "downward" if predicted_price < latest_price * 0.98 else "stable"
        return (
            forecast_points,
            predicted_price,
            confidence,
            f"7-day {direction} forecast from the latest {len(recent)} historical price days. Confidence reflects history depth and volatility.",
        )

    def predict_record_for_date(
        self,
        records: list[MarketRecord],
        selected_date: date,
        price_attribute: str = "modal_price",
    ) -> tuple[MarketRecord | None, list[ChartPoint], float, str | None]:
        if not records:
            return None, [], 0.0, None
        latest = self.best_record(records)
        forecast_points, predicted_modal, confidence, message = self.forecast_from_records(
            records[-120:],
            price_attribute,
            history_available=True,
        )
        if not predicted_modal:
            recent = records[-7:] if len(records) >= 7 else records
            predicted_modal = round(sum(item.modal_price for item in recent) / len(recent), 2)
            confidence = 0.35
            message = "Predicted from recent rolling average due to limited trend depth."
        spread_min = latest.min_price / latest.modal_price if latest.modal_price else 0.92
        spread_max = latest.max_price / latest.modal_price if latest.modal_price else 1.08
        if spread_min >= 0.99:
            spread_min = 0.92
        if spread_max <= 1.01:
            spread_max = 1.08
        predicted = MarketRecord(
            commodity=latest.commodity,
            state=latest.state,
            district=latest.district,
            market=latest.market,
            modal_price=round(predicted_modal, 2),
            min_price=round(max(0, predicted_modal * spread_min), 2),
            max_price=round(max(predicted_modal, predicted_modal * spread_max), 2),
            arrival_date=selected_date.strftime("%d/%m/%Y"),
        )
        if not forecast_points:
            forecast_points = [ChartPoint(label=predicted.arrival_date, value=predicted.modal_price)]
        return predicted, forecast_points, confidence, message

    def best_record(self, records: list[MarketRecord]) -> MarketRecord:
        return max(records, key=lambda item: item.modal_price)
