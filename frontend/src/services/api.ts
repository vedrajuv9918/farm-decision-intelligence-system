import axios from "axios";

import type {
  CropDecisionResponse,
  ExpenseAnalysisResponse,
  Location,
  MandiOptionsResponse,
  MandiPricesResponse,
  MarketDecisionResponse,
  RiskAnalysisResponse
} from "../types/api";


// =========================================================
// AUTH TYPES
// =========================================================

export type AuthUser = {
  full_name: string;
  email: string;
  has_farm_profile: boolean;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  user: AuthUser | null;
};


// =========================================================
// CUSTOM API ERROR
// =========================================================

export class ApiError extends Error {

  status?: number;

  payload?: unknown;

  constructor(
    message: string,
    status?: number,
    payload?: unknown
  ) {

    super(message);

    this.name = "ApiError";

    this.status = status;

    this.payload = payload;
  }
}


// =========================================================
// AXIOS INSTANCE
// =========================================================

const api = axios.create({
  baseURL: "http://127.0.0.1:8001/api",
  timeout: 100000,
});


// =========================================================
// ERROR NORMALIZER
// =========================================================

function normalizeApiError(error: unknown): never {

  if (axios.isAxiosError(error)) {

    const payload = error.response?.data as
      | { message?: string; detail?: string }
      | undefined;

    throw new ApiError(
      payload?.message ??
      payload?.detail ??
      error.message,

      error.response?.status,

      error.response?.data
    );
  }

  throw error;
}


// =========================================================
// AUTH APIs
// =========================================================

export async function registerAccount(payload: {
  full_name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {

  try {

    const { data } = await api.post<AuthResponse>(
      "/auth/register",
      payload
    );

    return data;

  } catch (error) {

    normalizeApiError(error);
  }
}


export async function loginAccount(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {

  try {

    const { data } = await api.post<AuthResponse>(
      "/auth/login",
      payload
    );

    return data;

  } catch (error) {

    normalizeApiError(error);
  }
}


export async function updateFarmProfileStatus(payload: {
  email: string;
  has_farm_profile: boolean;
}): Promise<AuthResponse> {

  try {

    const { data } = await api.post<AuthResponse>(
      "/auth/farm-profile",
      payload
    );

    return data;

  } catch (error) {

    normalizeApiError(error);
  }
}


// =========================================================
// LOCATION SEARCH
// =========================================================

export async function searchLocations(
  q: string
): Promise<Location[]> {

  if (q.trim().length < 2) {
    return [];
  }

  const { data } = await api.get<Location[]>(
    "/locations",
    {
      params: { q },
    }
  );

  return data;
}


// =========================================================
// CROP DECISION
// =========================================================

export async function cropDecision(payload: {
  location: Location;
  soil_type: string;
  season: string;
}): Promise<CropDecisionResponse> {

  const { data } = await api.post<CropDecisionResponse>(
    "/crop-decision",
    payload
  );

  return data;
}


// =========================================================
// MARKET DECISION
// =========================================================

export async function marketDecision(payload: {
  crop: string;
  location: Location;
  timeframe?: string;
  market?: string;
  selected_date?: string;
}): Promise<MarketDecisionResponse> {

  try {

    const { data } = await api.post<MarketDecisionResponse>(
      "/market-decision",
      payload,
      {
        timeout: 30000,
      }
    );

    return data;

  } catch (error) {

    normalizeApiError(error);
  }
}


// =========================================================
// MANDI PRICES
// =========================================================

export async function mandiPrices(payload: {
  crop?: string;
  state?: string;
  market?: string;
  search?: string;
  selected_date?: string;
  timeframe?: string;
  price_attribute?: string;
}): Promise<MandiPricesResponse> {

  try {

    const { data } = await api.post<MandiPricesResponse>(
      "/mandi-prices",
      payload,
      {
        timeout: 100000,
      }
    );

    return data;

  } catch (error) {

    normalizeApiError(error);
  }
}


// =========================================================
// MANDI OPTIONS
// =========================================================

export async function mandiOptions(payload: {
  crop?: string;
  state?: string;
  market?: string;
}): Promise<MandiOptionsResponse> {

  try {

    const { data } = await api.post<MandiOptionsResponse>(
      "/mandi-options",
      payload,
      {
        timeout: 150000,
      }
    );

    return data;

  } catch (error) {

    normalizeApiError(error);
  }
}


// =========================================================
// EXPENSE ANALYSIS
// =========================================================

export async function expenseAnalysis(payload: {
  crop: string;
  acreage: number;
  fertilizer_cost: number;
  labor_cost: number;
  irrigation_cost: number;
}): Promise<ExpenseAnalysisResponse> {

  const { data } = await api.post<ExpenseAnalysisResponse>(
    "/expense-analysis",
    payload
  );

  return data;
}


// =========================================================
// RISK ANALYSIS
// =========================================================

export async function riskAnalysis(payload: {
  location: Location;
  crop: string;
  season: string;
  soil_type?: string;
}): Promise<RiskAnalysisResponse> {

  const { data } = await api.post<RiskAnalysisResponse>(
    "/risk-analysis",
    payload
  );

  return data;
}
