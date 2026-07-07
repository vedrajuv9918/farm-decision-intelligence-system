from __future__ import annotations

from pydantic import BaseModel, Field


class Location(BaseModel):
    label: str
    lat: float
    lon: float
    state: str | None = None
    district: str | None = None


class WeatherSnapshot(BaseModel):
    temperature: float
    humidity: float
    rainfall: float
    condition: str
    wind_speed: float
    rainfall_period: str = "recent observed rain"
    forecast_summary: str | None = None
    anomalies: list[str] = []


class ChartPoint(BaseModel):
    label: str
    value: float


class CropDecisionRequest(BaseModel):
    location: Location
    soil_type: str = Field(min_length=2)
    season: str = Field(min_length=2)


class CropRecommendation(BaseModel):
    crop: str
    profit: float
    risk: str
    decision: str
    explanation: str
    confidence: float
    suitability_score: float = 0
    risk_score: float = 0
    expected_yield: float = 0
    water_requirement: str = "Medium"
    market_price: float | None = None
    region_match: bool = False
    reasons: list[str] = []


class CropDecisionResponse(BaseModel):
    weather: WeatherSnapshot
    recommendations: list[CropRecommendation]
    weather_trend: list[ChartPoint]


class MarketDecisionRequest(BaseModel):
    crop: str = Field(min_length=2)
    location: Location
    timeframe: str = "weekly"
    market: str | None = None
    selected_date: str | None = None


class MarketRecord(BaseModel):
    commodity: str
    state: str
    district: str
    market: str
    modal_price: float
    min_price: float
    max_price: float
    arrival_date: str


class MarketDecisionResponse(BaseModel):
    decision: str
    trend: str
    best_market: str
    explanation: str
    latest_price: float | None
    records: list[MarketRecord]
    nearby_records: list[MarketRecord] = []
    price_trend: list[ChartPoint]
    selected_market: str | None = None
    selected_date: str | None = None
    selected_modal_price: float | None = None
    historical_average: float | None = None
    context_label: str = ""
    comparison_label: str = ""
    api_source: str = "data.gov.in Agmarknet live API"
    history_available: bool = False
    history_message: str | None = None
    recommendation_confidence: float = 0.0
    moving_average: float | None = None
    volatility: float | None = None
    forecast_points: list[ChartPoint] = []
    predicted_price: float | None = None
    prediction_confidence: float = 0.0
    forecast_message: str | None = None
    is_prediction: bool = False


class MandiPricesRequest(BaseModel):
    crop: str | None = None
    state: str | None = None
    market: str | None = None
    search: str | None = None
    selected_date: str | None = None
    timeframe: str = "weekly"
    price_attribute: str = "modal_price"


class MandiPricesResponse(BaseModel):
    records: list[MarketRecord]
    trend: str
    price_trend: list[ChartPoint]
    last_updated: str
    selected_date: str | None = None
    timeframe: str = "weekly"
    price_attribute: str = "modal_price"
    historical_average: float | None = None
    history_available: bool = False
    history_message: str | None = None
    available_markets: list[str] = []
    available_commodities: list[str] = []
    api_source: str = "data.gov.in Agmarknet live API"
    history_source: str = "mandi_history dataset"
    moving_average: float | None = None
    volatility: float | None = None
    is_prediction: bool = False


class MandiOptionsRequest(BaseModel):
    state: str | None = None
    market: str | None = None
    crop: str | None = None


class MandiOptionsResponse(BaseModel):
    states: list[str] = []
    markets: list[str] = []
    commodities: list[str] = []


class ExpenseAnalysisRequest(BaseModel):
    crop: str = Field(min_length=2)
    acreage: float = Field(gt=0)
    fertilizer_cost: float = Field(ge=0)
    labor_cost: float = Field(ge=0)
    irrigation_cost: float = Field(ge=0)


class ExpenseInsight(BaseModel):
    category: str
    alert: str
    suggestion: str
    deviation_percent: float


class ExpenseAnalysisResponse(BaseModel):
    status: str
    insights: list[ExpenseInsight]
    comparison: list[ChartPoint]
    anomaly_score: float


class RiskAnalysisRequest(BaseModel):
    location: Location
    crop: str = Field(min_length=2)
    season: str = Field(min_length=2)
    soil_type: str | None = None


class RiskAnalysisResponse(BaseModel):
    risk: str
    alert: str
    score: float
    factors: list[str]
    weather: WeatherSnapshot


class HealthResponse(BaseModel):
    status: str
    service: str
