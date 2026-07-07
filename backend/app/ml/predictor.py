from __future__ import annotations

from functools import lru_cache

import joblib
import pandas as pd

from app.ml.train_models import DATA_PATH, EXPENSE_MODEL_PATH, MODEL_PATH, ensure_models


@lru_cache
def crop_catalog() -> pd.DataFrame:
    return pd.read_csv(DATA_PATH)


@lru_cache
def crop_model():
    ensure_models()
    return joblib.load(MODEL_PATH)


@lru_cache
def expense_model():
    ensure_models()
    return joblib.load(EXPENSE_MODEL_PATH)


def predict_crop_profit(
    *,
    soil_type: str,
    season: str,
    temperature: float,
    humidity: float,
    rainfall: float,
    state: str | None = None,
    market_prices: dict[str, float] | None = None,
) -> list[dict]:
    data = crop_catalog()
    state_normalized = (state or "").strip().lower()
    if state_normalized:
        regional = data[data["states"].str.lower().str.contains(state_normalized, regex=False, na=False)]
        if not regional.empty:
            data = regional

    candidates = data.groupby("crop", as_index=False).agg(
        {
            "market_price": "median",
            "cost_per_acre": "median",
            "yield_qtl_per_acre": "median",
            "risk_label": lambda x: x.mode().iat[0],
            "soil_type": lambda x: list(x),
            "season": lambda x: list(x),
            "temperature": "median",
            "humidity": "median",
            "rainfall": "median",
            "states": lambda x: sorted(set(",".join(x).split(","))),
        }
    )
    candidates["preferred_soils"] = candidates["soil_type"]
    candidates["preferred_seasons"] = candidates["season"]
    candidates["regional_states"] = candidates["states"]
    candidates["ideal_temperature"] = candidates["temperature"]
    candidates["ideal_humidity"] = candidates["humidity"]
    candidates["ideal_rainfall"] = candidates["rainfall"]
    candidates["soil_type"] = soil_type
    candidates["season"] = season
    candidates["temperature"] = temperature
    candidates["humidity"] = humidity
    candidates["rainfall"] = rainfall
    if market_prices:
        candidates["market_price"] = candidates.apply(
            lambda row: market_prices.get(str(row["crop"]).lower(), row["market_price"]),
            axis=1,
        )

    features = candidates[
        [
            "crop",
            "soil_type",
            "season",
            "temperature",
            "humidity",
            "rainfall",
            "market_price",
            "cost_per_acre",
            "yield_qtl_per_acre",
        ]
    ]
    predictions = crop_model().predict(features)
    candidates["profit"] = predictions
    return candidates.to_dict(orient="records")


def expense_anomaly_score(fertilizer_cost: float, labor_cost: float, irrigation_cost: float) -> float:
    features = pd.DataFrame(
        [
            {
                "fertilizer_cost": fertilizer_cost,
                "labor_cost": labor_cost,
                "irrigation_cost": irrigation_cost,
            }
        ]
    )
    return float(expense_model().score_samples(features)[0])
