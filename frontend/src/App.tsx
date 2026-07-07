import { useEffect, useState } from "react";
import { AppLayout } from "./components/AppLayout";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { CropIntelligence } from "./pages/CropIntelligence";
import { DashboardOverview } from "./pages/DashboardOverview";
import { ExpenseIntelligence } from "./pages/ExpenseIntelligence";
import { FarmProfileSetup } from "./pages/FarmProfileSetup";
import { LandingPage } from "./pages/LandingPage";
import { MarketIntelligence } from "./pages/MarketIntelligence";
import { MandiPricesPage } from "./pages/MandiPricesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RiskIntelligence } from "./pages/RiskIntelligence";
import type { CropDecisionResponse, ExpenseAnalysisResponse, MarketDecisionResponse, RiskAnalysisResponse } from "./types/api";

function normalizeRoute(pathname: string) {
  return pathname;
}

type ModuleMetadata = {
  status: "Live" | "Cached" | "No Data";
  timestamp: string | null;
};

const defaultMetadata = (): ModuleMetadata => ({
  status: "No Data",
  timestamp: null
});

function App() {
  const [route, setRoute] = useState(normalizeRoute(window.location.pathname));
  const [cropData, setCropData] = useState<CropDecisionResponse | null>(null);
  const [marketData, setMarketData] = useState<MarketDecisionResponse | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseAnalysisResponse | null>(null);
  const [riskData, setRiskData] = useState<RiskAnalysisResponse | null>(null);
  
  const [cropMetadata, setCropMetadata] = useState<ModuleMetadata>(defaultMetadata());
  const [marketMetadata, setMarketMetadata] = useState<ModuleMetadata>(defaultMetadata());
  const [expenseMetadata, setExpenseMetadata] = useState<ModuleMetadata>(defaultMetadata());
  const [riskMetadata, setRiskMetadata] = useState<ModuleMetadata>(defaultMetadata());

  const [profileVersion, setProfileVersion] = useState(0);

  // Load module data caches from local storage on mount
  useEffect(() => {
    try {
      const crop = localStorage.getItem("farmwise_cache_crop");
      const market = localStorage.getItem("farmwise_cache_market");
      const expense = localStorage.getItem("farmwise_cache_expense");
      const risk = localStorage.getItem("farmwise_cache_risk");
      
      if (crop) {
        const parsed = JSON.parse(crop);
        setCropData(parsed.data);
        setCropMetadata({ status: "Cached", timestamp: parsed.timestamp });
      }
      if (market) {
        const parsed = JSON.parse(market);
        setMarketData(parsed.data);
        setMarketMetadata({ status: "Cached", timestamp: parsed.timestamp });
      }
      if (expense) {
        const parsed = JSON.parse(expense);
        setExpenseData(parsed.data);
        setExpenseMetadata({ status: "Cached", timestamp: parsed.timestamp });
      }
      if (risk) {
        const parsed = JSON.parse(risk);
        setRiskData(parsed.data);
        setRiskMetadata({ status: "Cached", timestamp: parsed.timestamp });
      }
    } catch {
      // Ignored
    }
  }, [profileVersion]);

  useEffect(() => {
    const handlePop = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    const isPrivate = [
      "/dashboard",
      "/profile",
      "/crop-intelligence",
      "/market-intelligence",
      "/mandi-prices",
      "/expense-intelligence",
      "/risk-intelligence",
      "/farm-profile/setup"
    ].includes(route);

    const hasSession = !!localStorage.getItem("farmwise_session");

    if (isPrivate && !hasSession) {
      navigate("/auth/login");
    } else if ((route === "/auth/login" || route === "/auth/register") && hasSession) {
      navigate("/dashboard");
    }
  }, [route]);

  function navigate(path: string) {
    if (path === route) return;
    window.history.pushState({}, "", path);
    setRoute(path);
  }

  function handleLogin(hasFarmProfile: boolean) {
    navigate(hasFarmProfile ? "/dashboard" : "/farm-profile/setup");
  }

  function handleRegister() {
    localStorage.removeItem("farmwise_session");
  }

  function refreshProfileSignals() {
    setCropData(null);
    setMarketData(null);
    setExpenseData(null);
    setRiskData(null);
    setCropMetadata(defaultMetadata());
    setMarketMetadata(defaultMetadata());
    setExpenseMetadata(defaultMetadata());
    setRiskMetadata(defaultMetadata());
    localStorage.removeItem("farmwise_cache_crop");
    localStorage.removeItem("farmwise_cache_market");
    localStorage.removeItem("farmwise_cache_expense");
    localStorage.removeItem("farmwise_cache_risk");
    localStorage.removeItem("farmwise_cache_expense_inputs");
    setProfileVersion((version) => version + 1);
  }

  // Setters wrappers to persist to localStorage & track Live status
  const updateCropData = (data: CropDecisionResponse | null) => {
    setCropData(data);
    const ts = data ? new Date().toLocaleString() : null;
    const meta: ModuleMetadata = { status: data ? "Live" : "No Data", timestamp: ts };
    setCropMetadata(meta);
    if (data) {
      localStorage.setItem("farmwise_cache_crop", JSON.stringify({ data, timestamp: ts }));
    } else {
      localStorage.removeItem("farmwise_cache_crop");
    }
  };

  const updateMarketData = (data: MarketDecisionResponse | null) => {
    setMarketData(data);
    const ts = data ? new Date().toLocaleString() : null;
    const meta: ModuleMetadata = { status: data ? "Live" : "No Data", timestamp: ts };
    setMarketMetadata(meta);
    if (data) {
      localStorage.setItem("farmwise_cache_market", JSON.stringify({ data, timestamp: ts }));
    } else {
      localStorage.removeItem("farmwise_cache_market");
    }
  };

  const updateExpenseData = (data: ExpenseAnalysisResponse | null) => {
    setExpenseData(data);
    const ts = data ? new Date().toLocaleString() : null;
    const meta: ModuleMetadata = { status: data ? "Live" : "No Data", timestamp: ts };
    setExpenseMetadata(meta);
    if (data) {
      localStorage.setItem("farmwise_cache_expense", JSON.stringify({ data, timestamp: ts }));
    } else {
      localStorage.removeItem("farmwise_cache_expense");
    }
  };

  const updateRiskData = (data: RiskAnalysisResponse | null) => {
    setRiskData(data);
    const ts = data ? new Date().toLocaleString() : null;
    const meta: ModuleMetadata = { status: data ? "Live" : "No Data", timestamp: ts };
    setRiskMetadata(meta);
    if (data) {
      localStorage.setItem("farmwise_cache_risk", JSON.stringify({ data, timestamp: ts }));
    } else {
      localStorage.removeItem("farmwise_cache_risk");
    }
  };

  if (route === "/") {
    return <LandingPage navigate={navigate} />;
  }

  if (route === "/auth/register") {
    return <RegisterPage navigate={navigate} onRegister={handleRegister} />;
  }

  if (route === "/auth/login") {
    return <LoginPage navigate={navigate} onLogin={handleLogin} />;
  }

  if (route === "/farm-profile/setup") {
    return <FarmProfileSetup navigate={navigate} onProfileSaved={refreshProfileSignals} />;
  }

  const page = (() => {
    switch (route) {
      case "/dashboard":
      case "/profile":
        return (
          <DashboardOverview
            key={profileVersion}
            navigate={navigate}
            onProfileUpdated={refreshProfileSignals}
            cropData={cropData}
            marketData={marketData}
            cropMetadata={cropMetadata}
            marketMetadata={marketMetadata}
            setCropData={updateCropData}
            setMarketData={updateMarketData}
          />
        );
      case "/crop-intelligence":
        return <CropIntelligence cropData={cropData} riskData={riskData} setCropData={updateCropData} setRiskData={updateRiskData} />;
      case "/market-intelligence":
        return <MarketIntelligence marketData={marketData} setMarketData={updateMarketData} />;
      case "/mandi-prices":
        return <MandiPricesPage />;
      case "/expense-intelligence":
        return <ExpenseIntelligence expenseData={expenseData} setExpenseData={updateExpenseData} />;
      case "/risk-intelligence":
        return <RiskIntelligence riskData={riskData} setRiskData={updateRiskData} />;
      default:
        return (
          <DashboardOverview
            key={profileVersion}
            navigate={navigate}
            onProfileUpdated={refreshProfileSignals}
            cropData={cropData}
            marketData={marketData}
            cropMetadata={cropMetadata}
            marketMetadata={marketMetadata}
            setCropData={updateCropData}
            setMarketData={updateMarketData}
          />
        );
    }
  })();

  return (
    <AppLayout route={route} navigate={navigate}>
      {page}
    </AppLayout>
  );
}

export default App;
