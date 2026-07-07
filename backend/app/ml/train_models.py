from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "crop_training.csv"
MODEL_PATH = BASE_DIR / "crop_profit_model.pkl"
EXPENSE_MODEL_PATH = BASE_DIR / "expense_anomaly_model.pkl"


def train_crop_profit_model() -> None:
    data = pd.read_csv(DATA_PATH)
    feature_columns = [
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
    X = data[feature_columns]
    y = data["profit_per_acre"]

    preprocessing = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore"), ["crop", "soil_type", "season"]),
            (
                "numeric",
                StandardScaler(),
                ["temperature", "humidity", "rainfall", "market_price", "cost_per_acre", "yield_qtl_per_acre"],
            ),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocess", preprocessing),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=220,
                    random_state=42,
                    min_samples_leaf=1,
                    max_depth=8,
                ),
            ),
        ]
    )
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)


def train_expense_anomaly_model() -> None:
    data = pd.read_csv(DATA_PATH)
    expenses = pd.DataFrame(
        {
            "fertilizer_cost": data["cost_per_acre"] * 0.24,
            "labor_cost": data["cost_per_acre"] * 0.42,
            "irrigation_cost": data["cost_per_acre"] * 0.16,
        }
    )
    model = IsolationForest(contamination=0.12, random_state=42)
    model.fit(expenses)
    joblib.dump(model, EXPENSE_MODEL_PATH)


def ensure_models() -> None:
    if not MODEL_PATH.exists():
        train_crop_profit_model()
    if not EXPENSE_MODEL_PATH.exists():
        train_expense_anomaly_model()


if __name__ == "__main__":
    train_crop_profit_model()
    train_expense_anomaly_model()
    print(f"Saved {MODEL_PATH}")
    print(f"Saved {EXPENSE_MODEL_PATH}")
