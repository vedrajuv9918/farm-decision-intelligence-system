from __future__ import annotations

from app.ml.predictor import predict_crop_profit
from app.schemas.common import CropRecommendation, MarketRecord, WeatherSnapshot
from app.services.risk_service import RiskService


RISK_WEIGHT = {"low": 1.0, "medium": 0.82, "high": 0.58}


class DecisionEngine:
    def __init__(self) -> None:
        self.risk_service = RiskService()

    def rank_crops(
        self,
        *,
        soil_type: str,
        season: str,
        weather: WeatherSnapshot,
        state: str | None = None,
        market_prices: dict[str, float] | None = None,
    ) -> list[CropRecommendation]:
        risk_level, _, risk_score, factors = self.risk_service.analyze(weather, season)
        predictions = predict_crop_profit(
            soil_type=soil_type,
            season=season,
            temperature=weather.temperature,
            humidity=weather.humidity,
            rainfall=weather.rainfall,
            state=state,
            market_prices=market_prices,
        )

        ranked = []
        for row in predictions:
            suitability, suitability_reasons = self.suitability_score(row=row, soil_type=soil_type, season=season, weather=weather)
            market_price = market_prices.get(str(row["crop"]).lower()) if market_prices else None
            regional_match = self.matches_state(row.get("regional_states", []), state)
            market_multiplier = 1.0
            if market_price and row.get("market_price"):
                market_multiplier = max(0.7, min(1.35, market_price / float(row["market_price"])))
            adjusted_profit = float(row["profit"]) * RISK_WEIGHT[risk_level] * (0.65 + suitability * 0.35) * market_multiplier
            confidence = max(0.45, min(0.96, 0.55 + suitability * 0.35 - risk_score * 0.18 + (0.06 if market_price else 0)))
            if adjusted_profit > 45000 and risk_level == "low":
                decision = "Highly Recommended"
            elif adjusted_profit > 25000 and risk_level in {"low", "medium"}:
                decision = "Recommended"
            elif risk_level == "high":
                decision = "Avoid for now"
            else:
                decision = "Consider with caution"

            explanation = self.crop_explanation(
                crop=str(row["crop"]),
                profit=adjusted_profit,
                risk=risk_level,
                weather=weather,
                factors=factors,
                state=state,
                suitability=suitability,
                market_price=market_price,
                regional_match=regional_match,
            )
            reasons = suitability_reasons + [
                f"Climate risk is {risk_level} based on live weather signals.",
                f"Estimated market price is Rs {market_price:.0f}/quintal from live mandi data." if market_price else "Using trained market baseline because live mandi price was unavailable for this crop.",
            ]
            ranked.append(
                CropRecommendation(
                    crop=str(row["crop"]),
                    profit=round(adjusted_profit, 2),
                    risk=risk_level,
                    decision=decision,
                    explanation=explanation,
                    confidence=round(confidence, 2),
                    suitability_score=round(suitability * 100, 1),
                    risk_score=round(risk_score * 100, 1),
                    expected_yield=round(float(row.get("yield_qtl_per_acre") or 0), 1),
                    water_requirement=self.water_requirement(float(row.get("ideal_rainfall") or 0)),
                    market_price=round(market_price, 2) if market_price else None,
                    region_match=regional_match,
                    reasons=reasons[:5],
                )
            )

        return sorted(
            ranked,
            key=lambda item: (item.region_match, item.decision != "Avoid for now", item.suitability_score, item.profit),
            reverse=True,
        )[:6]

    def crop_explanation(
        self,
        *,
        crop: str,
        profit: float,
        risk: str,
        weather: WeatherSnapshot,
        factors: list[str],
        state: str | None,
        suitability: float,
        market_price: float | None,
        regional_match: bool,
    ) -> str:
        region_text = f" for {state}" if state else ""
        market_text = f" Live mandi prices strengthen the estimate at Rs {market_price:.0f}/quintal." if market_price else ""
        regional_text = "It is regionally suitable" if regional_match else "It is included based on nearby agronomic patterns"
        if risk == "low" and profit > 40000:
            return (
                f"{crop} is a strong option{region_text}. {regional_text}, matches current weather with a "
                f"{suitability * 100:.0f}% suitability score, and shows low climate risk at {weather.temperature:.1f} C."
                f"{market_text}"
            )
        if risk == "high":
            return f"{crop} is risky{region_text} right now because {', '.join(factors[:2])}. Suitability is {suitability * 100:.0f}%.{market_text}"
        return f"{crop} has balanced potential{region_text}; suitability is {suitability * 100:.0f}% and expected profit is adjusted for {risk} weather risk.{market_text}"

    def suitability_score(self, *, row: dict, soil_type: str, season: str, weather: WeatherSnapshot) -> tuple[float, list[str]]:
        score = 0.0
        reasons = []
        preferred_soils = [str(item).lower() for item in row.get("preferred_soils", [])]
        preferred_seasons = [str(item).lower() for item in row.get("preferred_seasons", [])]

        if soil_type.lower() in preferred_soils:
            score += 0.25
            reasons.append(f"{soil_type} soil is compatible with this crop.")
        else:
            score += 0.1
            reasons.append(f"{soil_type} soil has partial compatibility; monitor nutrient and moisture management.")

        if season.lower() in preferred_seasons or "annual" in preferred_seasons:
            score += 0.25
            reasons.append(f"{season} season matches the crop calendar.")
        else:
            score += 0.08
            reasons.append(f"{season} is outside the strongest crop calendar window.")

        temp_delta = abs(weather.temperature - float(row.get("ideal_temperature") or weather.temperature))
        humidity_delta = abs(weather.humidity - float(row.get("ideal_humidity") or weather.humidity))
        rainfall_delta = abs(weather.rainfall - float(row.get("ideal_rainfall") or weather.rainfall))

        weather_score = max(0.0, 0.25 - temp_delta / 80 - humidity_delta / 250)
        rainfall_score = max(0.0, 0.25 - rainfall_delta / 700)
        score += weather_score + rainfall_score
        reasons.append(f"Live weather is {weather.condition} with {weather.temperature:.1f} C and {weather.rainfall:.1f} mm rainfall.")
        return max(0.0, min(score, 1.0)), reasons

    def matches_state(self, states: list[str], state: str | None) -> bool:
        if not state:
            return False
        return any(item.strip().lower() == state.strip().lower() for item in states)

    def water_requirement(self, ideal_rainfall: float) -> str:
        if ideal_rainfall >= 150:
            return "High"
        if ideal_rainfall >= 70:
            return "Medium"
        return "Low"

    def market_decision(
        self,
        *,
        trend: str,
        best_market: MarketRecord | None,
        history_available: bool = True,
        history_points: int = 0,
    ) -> tuple[str, str, float]:
        confidence = min(0.9, 0.35 + history_points * 0.08) if history_available else 0.22
        if not history_available:
            decision = "LATEST SNAPSHOT"
            explanation = (
                "Limited confidence due to insufficient historical mandi data. "
                "Use this as the latest live market snapshot, not a WAIT/SELL forecast."
            )
            if best_market:
                explanation += f" Best current market is {best_market.market} in {best_market.district} at Rs {best_market.modal_price:.0f}/quintal."
            return decision, explanation, round(confidence, 2)

        if trend == "increasing":
            decision = "WAIT"
            explanation = "WAIT because mandi prices are rising compared with the recent average."
        elif trend == "decreasing":
            decision = "SELL"
            explanation = "SELL because recent mandi prices are weakening and delay may reduce realization."
        elif trend == "stable":
            decision = "SELL SELECTIVELY"
            explanation = "Prices are stable; sell at the best available mandi while keeping some stock if storage is safe."
        else:
            decision = "INSUFFICIENT DATA"
            explanation = "Not enough clean dated mandi records were available to infer a reliable trend."

        if best_market:
            explanation += f" Best current market is {best_market.market} in {best_market.district} at Rs {best_market.modal_price:.0f}/quintal."
        return decision, explanation, round(confidence, 2)
