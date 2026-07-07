from datetime import date

from fastapi import APIRouter, HTTPException

from app.schemas.common import (
    CropDecisionRequest,
    CropDecisionResponse,
    ExpenseAnalysisRequest,
    ExpenseAnalysisResponse,
    MarketDecisionRequest,
    MarketDecisionResponse,
    MandiOptionsRequest,
    MandiOptionsResponse,
    MandiPricesRequest,
    MandiPricesResponse,
    RiskAnalysisRequest,
    RiskAnalysisResponse,
)
from app.services.expense_service import ExpenseService
from app.services.history_service import HistoryService
from app.services.market_service import CurrentMarketService, HistoricalMarketService
from app.services.risk_service import RiskService
from app.services.weather_service import WeatherService
from app.utils.decision_engine import DecisionEngine
from app.utils.http import ExternalServiceError

router = APIRouter()


@router.post("/crop-decision", response_model=CropDecisionResponse)
async def crop_decision(request: CropDecisionRequest) -> CropDecisionResponse:
    try:
        weather_service = WeatherService()
        try:
            weather = await weather_service.get_weather(request.location.lat, request.location.lon)
        except ExternalServiceError:
            weather = weather_service.fallback_weather(request.location.state)
        from app.ml.predictor import crop_catalog

        state = request.location.state
        catalog = crop_catalog()
        regional_catalog = catalog[catalog["states"].str.lower().str.contains((state or "").lower(), regex=False, na=False)] if state else catalog
        candidate_crops = sorted((regional_catalog if not regional_catalog.empty else catalog)["crop"].unique().tolist())
        market_prices = await CurrentMarketService().get_latest_crop_prices(crops=candidate_crops, state=state)
        recommendations = DecisionEngine().rank_crops(
            soil_type=request.soil_type,
            season=request.season,
            weather=weather,
            state=state,
            market_prices=market_prices,
        )
        return CropDecisionResponse(
            weather=weather,
            recommendations=recommendations,
            weather_trend=weather_service.weather_chart(weather),
        )
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/market-decision", response_model=MarketDecisionResponse)
async def market_decision(request: MarketDecisionRequest) -> MarketDecisionResponse:
    try:
        service = CurrentMarketService()
        historical_service = HistoricalMarketService()
        history_service = HistoryService()
        requested_crop = request.crop.strip()
        requested_market = request.market.strip() if request.market else None
        
        all_records = []
        try:
            all_records = await service.get_prices(requested_crop, request.location)
        except Exception:
            pass
            
        if not all_records:
            all_records = await history_service.records(
                state=request.location.state,
                market=requested_market,
                commodity=requested_crop,
                limit=10000,
            )
        explicit_date = bool(request.selected_date)
        selected_dt = service.resolve_selected_date(request.selected_date, all_records)
        future_date = selected_dt.date() > date.today() if selected_dt else False
        latest_date_records = service.records_for_date(all_records, selected_dt)
        if future_date:
            latest_date_records = []
        elif explicit_date and not latest_date_records:
            raise HTTPException(
                status_code=404,
                detail=f"No {requested_crop} mandi records found for {request.selected_date} in {request.location.state or 'selected region'}",
            )
        comparison_pool = latest_date_records or all_records
        if not comparison_pool:
            raise HTTPException(
                status_code=404,
                detail=f"No mandi records found for {requested_crop} in {request.location.state or 'selected region'}"
            )
        selected_seed = None
        if requested_market:
            market_matches = service.filter_records(comparison_pool, market=requested_market)
            if not market_matches:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"No live {requested_crop} records found for {requested_market} "
                        f"in {request.location.state or 'selected region'} on "
                        f"{selected_dt.strftime('%Y-%m-%d') if selected_dt else service.last_updated(all_records)}"
                    ),
                )
            selected_seed = service.best_market(market_matches)
        else:
            selected_seed = service.best_market(comparison_pool)
        selected_market = selected_seed.market
        selected_records = service.filter_records(all_records, market=selected_market)
        selected_latest_records = service.records_for_date(selected_records, selected_dt)
        predicted_record = None
        predicted_points = []
        predicted_confidence = 0.0
        predicted_message = None
        if future_date:
            predicted_record, predicted_points, predicted_confidence, predicted_message = history_service.predict_record_for_date(
                selected_records,
                selected_dt.date(),
            )
            selected_latest_records = [predicted_record] if predicted_record else []
        elif explicit_date and not selected_latest_records:
            raise HTTPException(
                status_code=404,
                detail=f"No {requested_crop} records found for {selected_market} on {request.selected_date}",
            )
        selected_latest_records = selected_latest_records or selected_records
        selected_latest = service.best_market(selected_latest_records)
        history = await history_service.analytics(
            state=request.location.state,
            market=selected_market,
            commodity=requested_crop,
            timeframe=request.timeframe,
            price_attribute="modal_price",
            selected_date=None if future_date else selected_dt.strftime("%Y-%m-%d") if selected_dt else None,
        )
        if future_date and predicted_record:
            history.forecast_points = predicted_points
            history.predicted_price = predicted_record.modal_price
            history.prediction_confidence = predicted_confidence
            history.forecast_message = predicted_message
        latest_price = selected_latest.modal_price
        if history.predicted_price and history.history_available:
            if history.predicted_price > latest_price * 1.02:
                trend_for_decision = "increasing"
            elif history.predicted_price < latest_price * 0.98:
                trend_for_decision = "decreasing"
            else:
                trend_for_decision = "stable"
        elif history.history_available and history.historical_average:
            if latest_price > history.historical_average * 1.03:
                trend_for_decision = "decreasing"
            elif latest_price < history.historical_average * 0.97:
                trend_for_decision = "increasing"
            else:
                trend_for_decision = history.trend
        else:
            trend_for_decision = history.trend
        decision, explanation, confidence = DecisionEngine().market_decision(
            trend=trend_for_decision,
            best_market=selected_latest,
            history_available=history.history_available,
            history_points=len(history.points),
        )
        if history.history_available and history.historical_average:
            comparison = latest_price - history.historical_average
            explanation += f" Current live price is Rs {comparison:.0f} above the historical average." if comparison >= 0 else f" Current live price is Rs {abs(comparison):.0f} below the historical average."
        if history.predicted_price:
            delta = history.predicted_price - latest_price
            forecast_direction = "higher" if delta >= 0 else "lower"
            explanation += f" Forecast indicates about Rs {abs(delta):.0f} {forecast_direction} in the next 7 days."
        comparison_records = [
            selected_latest,
            *[
                record
                for record in sorted(comparison_pool, key=lambda item: item.modal_price, reverse=True)
                if record.market != selected_market
            ],
        ]
        nearby_records = comparison_records[:12]
        selected_date_label = selected_dt.strftime("%Y-%m-%d") if selected_dt else None
        return MarketDecisionResponse(
            decision=decision,
            trend=trend_for_decision,
            best_market=f"{selected_latest.market}, {selected_latest.district}",
            explanation=explanation,
            latest_price=latest_price,
            records=selected_latest_records[:50],
            nearby_records=nearby_records,
            price_trend=history.points,
            selected_market=selected_market,
            selected_date=selected_date_label,
            selected_modal_price=selected_latest.modal_price,
            historical_average=history.historical_average,
            context_label=(
                f"Selected State: {request.location.state or 'selected region'} | "
                f"Selected Mandi: {selected_market} | Commodity: {requested_crop} | "
                f"Date: {selected_date_label or service.last_updated(selected_records)}"
            ),
            comparison_label=(
                f"Selected Mandi + Nearby Mandis: same commodity, state, and date "
                f"in {request.location.state or 'selected region'}"
            ),
            history_available=history.history_available,
            history_message=history.history_message,
            recommendation_confidence=confidence,
            moving_average=history.moving_average,
            volatility=history.volatility,
            forecast_points=history.forecast_points,
            predicted_price=history.predicted_price,
            prediction_confidence=history.prediction_confidence,
            forecast_message=history.forecast_message,
            is_prediction=future_date,
        )
    except ExternalServiceError as exc:
        status_code = 404 if "No mandi records found" in str(exc) else 502
        detail = str(exc) if status_code == 404 else "Live mandi service is unavailable right now. Please try again in a moment."
        raise HTTPException(status_code=status_code, detail=detail) from exc


@router.post("/mandi-prices", response_model=MandiPricesResponse)
async def mandi_prices(request: MandiPricesRequest) -> MandiPricesResponse:
    try:
        service = CurrentMarketService()
        history_service = HistoryService()
        history = await history_service.analytics(
            state=request.state,
            market=request.market,
            commodity=request.crop,
            timeframe=request.timeframe,
            price_attribute=request.price_attribute,
            selected_date=request.selected_date,
        )
        _, history_markets, history_commodities = await history_service.options(
            state=request.state,
            market=request.market,
            commodity=None,
        )
        markets = history_markets[:500]
        commodities = history_commodities[:500]
        records = history.records
        selected_dt = service.resolve_selected_date(request.selected_date, records)
        future_date = selected_dt.date() > date.today() if selected_dt else False
        
        table_records = []
        if not request.selected_date and request.crop:
            try:
                table_records = await service.get_prices_for_filters(
                    crop=request.crop,
                    state=request.state,
                    market=request.market,
                    limit=100
                )
            except Exception:
                pass
                
        if not table_records:
            if selected_dt:
                table_records = service.records_for_date(records, selected_dt)
            else:
                table_records = records
        prediction_confidence = 0.0
        if future_date:
            predicted, forecast_points, prediction_confidence, prediction_message = history_service.predict_record_for_date(
                records,
                selected_dt.date(),
                request.price_attribute,
            )
            table_records = [predicted] if predicted else []
            history.points = forecast_points or history.points
            history.trend = "predicted"
            history.history_available = bool(predicted)
            history.history_message = prediction_message
        if request.selected_date and not table_records:
            table_records = []
        elif not request.selected_date and selected_dt:
            table_records = service.records_for_date(records, selected_dt) or records
        response_selected_date = request.selected_date or (selected_dt.strftime("%Y-%m-%d") if selected_dt else None)
        if not response_selected_date:
            response_latest_dt = service.resolve_selected_date(None, table_records)
            response_selected_date = response_latest_dt.strftime("%Y-%m-%d") if response_latest_dt else None
        return MandiPricesResponse(
            records=table_records[:250],
            trend=history.trend,
            price_trend=history.points,
            last_updated=service.last_updated(table_records or records or history.records),
            selected_date=response_selected_date,
            timeframe=request.timeframe,
            price_attribute=request.price_attribute,
            historical_average=history.historical_average,
            history_available=history.history_available,
            history_message=history.history_message if table_records else f"No mandi rows matched commodity '{request.crop}' in {request.state or 'selected state'}." if request.crop else history.history_message,
            available_markets=markets,
            available_commodities=commodities,
            api_source="mandi_price/final_dataset.csv",
            moving_average=history.moving_average,
            volatility=history.volatility,
            is_prediction=future_date,
        )
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail="Live mandi service is unavailable right now. Please try again in a moment.") from exc


@router.post("/mandi-options", response_model=MandiOptionsResponse)
async def mandi_options(request: MandiOptionsRequest) -> MandiOptionsResponse:
    try:
        history_service = HistoryService()
        states, markets, commodities = await history_service.options(
            state=request.state,
            market=request.market,
            commodity=request.crop,
        )
        return MandiOptionsResponse(states=states[:200], markets=markets[:500], commodities=commodities[:500])
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail="Live mandi options are unavailable right now. Please try again in a moment.") from exc


@router.post("/expense-analysis", response_model=ExpenseAnalysisResponse)
async def expense_analysis(request: ExpenseAnalysisRequest) -> ExpenseAnalysisResponse:
    insights, comparison, score = ExpenseService().analyze(request)
    status = "Review required" if any(item.deviation_percent > 20 for item in insights) else "Healthy"
    return ExpenseAnalysisResponse(status=status, insights=insights, comparison=comparison, anomaly_score=round(score, 3))


@router.post("/risk-analysis", response_model=RiskAnalysisResponse)
async def risk_analysis(request: RiskAnalysisRequest) -> RiskAnalysisResponse:
    try:
        weather_service = WeatherService()
        try:
            weather = await weather_service.get_weather(request.location.lat, request.location.lon)
        except ExternalServiceError:
            weather = weather_service.fallback_weather(request.location.state)
        risk, alert, score, factors = RiskService().analyze(
            weather,
            request.season,
            crop=request.crop,
            state=request.location.state,
            soil_type=request.soil_type,
        )
        return RiskAnalysisResponse(risk=risk, alert=alert, score=score, factors=factors, weather=weather)
    except ExternalServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


