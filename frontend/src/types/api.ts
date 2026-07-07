export type Location = {
  label: string;
  lat: number;
  lon: number;
  state?: string | null;
  district?: string | null;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type WeatherSnapshot = {
  temperature: number;
  humidity: number;
  rainfall: number;
  condition: string;
  wind_speed: number;
  rainfall_period: string;
  forecast_summary: string | null;
  anomalies: string[];
};

export type CropRecommendation = {
  crop: string;
  profit: number;
  risk: "low" | "medium" | "high" | string;
  decision: string;
  explanation: string;
  confidence: number;
  suitability_score: number;
  risk_score: number;
  expected_yield: number;
  water_requirement: string;
  market_price: number | null;
  region_match: boolean;
  reasons: string[];
};

export type CropDecisionResponse = {
  weather: WeatherSnapshot;
  recommendations: CropRecommendation[];
  weather_trend: ChartPoint[];
};

export type MarketDecisionResponse = {
  decision: string;
  trend: string;
  best_market: string;
  explanation: string;
  latest_price: number | null;
  records: MarketRecord[];
  nearby_records: MarketRecord[];
  price_trend: ChartPoint[];
  selected_market: string | null;
  selected_date: string | null;
  selected_modal_price: number | null;
  historical_average: number | null;
  context_label: string;
  comparison_label: string;
  api_source: string;
  history_available: boolean;
  history_message: string | null;
  recommendation_confidence: number;
  moving_average: number | null;
  volatility: number | null;
  forecast_points: ChartPoint[];
  predicted_price: number | null;
  prediction_confidence: number;
  forecast_message: string | null;
  is_prediction: boolean;
};

export type MarketRecord = {
  commodity: string;
  state: string;
  district: string;
  market: string;
  modal_price: number;
  min_price: number;
  max_price: number;
  arrival_date: string;
};

export type MandiPricesResponse = {
  records: MarketRecord[];
  trend: string;
  price_trend: ChartPoint[];
  last_updated: string;
  selected_date: string | null;
  timeframe: string;
  price_attribute: string;
  historical_average: number | null;
  history_available: boolean;
  history_message: string | null;
  available_markets: string[];
  available_commodities: string[];
  api_source: string;
  history_source: string;
  moving_average: number | null;
  volatility: number | null;
  is_prediction: boolean;
};

export type MandiOptionsResponse = {
  states: string[];
  markets: string[];
  commodities: string[];
};

export type ExpenseAnalysisResponse = {
  status: string;
  insights: Array<{
    category: string;
    alert: string;
    suggestion: string;
    deviation_percent: number;
  }>;
  comparison: ChartPoint[];
  anomaly_score: number;
};

export type RiskAnalysisResponse = {
  risk: string;
  alert: string;
  score: number;
  factors: string[];
  weather: WeatherSnapshot;
};
