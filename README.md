# 🌾 FarmWise — AI-Powered Farm Decision Intelligence System

> Smart Farming Decisions Powered by AI & Real-Time Data

FarmWise is a full-stack, production-oriented agriculture intelligence platform. It empowers farmers with live weather data, real-time mandi prices, ML-driven crop profitability rankings, expense analysis, and climate risk assessments — all from a clean, intuitive dashboard.

---

## ✨ Features

| Module | Description |
|---|---|
| 🏠 **Home / Farm Profile** | Manage multiple farm locations. Set an active farm to drive all analysis. |
| 🌾 **Crop Intelligence** | ML-ranked crop recommendations scored by profitability, suitability, and live weather. |
| 📈 **Market Intelligence** | AI market signal analysis — bullish/bearish/neutral — using live + historical mandi price data. |
| 💹 **Live Mandi Prices** | Real-time commodity prices across states with interactive charts and trend analysis. |
| 💰 **Expense Intelligence** | AI-driven farm cost analysis with anomaly detection and budgeting insights. |
| ⚠️ **Risk Intelligence** | Climate and market risk scoring for the active farm's season and crop. |
| 🌤️ **Live Weather** | Current weather fetched automatically based on farm GPS coordinates. |

---

## 🏗️ Architecture

```
farmwise/
├── backend/                  # FastAPI Python backend
│   ├── app/
│   │   ├── main.py           # Application entry point with lifespan hooks
│   │   ├── config.py         # Pydantic settings (.env loader)
│   │   ├── db.py             # SQLAlchemy async engine
│   │   ├── routes/           # API route handlers
│   │   │   ├── auth.py       # Register / Login
│   │   │   ├── decisions.py  # Crop, Market, Expense, Risk endpoints
│   │   │   ├── health.py     # Health check
│   │   │   └── locations.py  # Location autocomplete
│   │   ├── services/         # External API integrations
│   │   │   ├── weather.py    # OpenWeather API
│   │   │   └── market_service.py  # Dual Agmarknet API (current + historical)
│   │   ├── ml/               # Machine learning engine
│   │   │   ├── train_models.py
│   │   │   └── data/crop_training.csv
│   │   ├── models/           # SQLAlchemy ORM models
│   │   └── schemas/          # Pydantic request/response schemas
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── pages/            # Full-page components
│   │   ├── components/       # Shared UI components
│   │   ├── services/api.ts   # Typed API client
│   │   └── types/api.ts      # Shared TypeScript types
│   └── package.json
├── mandi_price/              # Local Agmarknet dataset cache
│   ├── final_dataset.csv     # ~4.5M rows (gitignored — auto-populated on startup)
│   └── metadata.json         # Last harvest date bookmark
├── update_mandi_dataset.py   # Standalone dataset harvest & pruning script
└── docker-compose.yml
```

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) + Uvicorn (async ASGI)
- SQLAlchemy (async) + asyncpg + aiosqlite
- scikit-learn (RandomForest, IsolationForest)
- pandas + pyarrow for high-performance dataset operations
- httpx + tenacity for resilient external API calls
- python-dotenv + pydantic-settings

**Frontend**
- React 18 + TypeScript
- Vite (HMR dev server)
- Tailwind CSS
- Recharts (interactive price/trend charts)
- Lucide React (icons)
- MUI Autocomplete (location search)

**External APIs**
- [OpenWeatherMap](https://openweathermap.org/api) — live weather by coordinates
- [data.gov.in Agmarknet](https://data.gov.in/) — current & historical mandi prices
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) — farm location geocoding

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# PostgreSQL connection string
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/farmwise

# OpenWeatherMap API key
OPENWEATHER_API_KEY=your_openweather_api_key

# Agmarknet (data.gov.in) — Current/Live mandi prices
DATA_GOV_API_KEY_CURRENT=your_current_data_gov_api_key
DATA_GOV_RESOURCE_ID_CURRENT=35985678-0d79-46b4-9ed6-6f13308a1d24

# Agmarknet (data.gov.in) — Historical mandi prices
DATA_GOV_API_KEY_HISTORICAL=your_historical_data_gov_api_key
DATA_GOV_RESOURCE_ID_HISTORICAL=9ef84268-d588-465a-a308-a864a43d0070

# Frontend CORS origin
FRONTEND_ORIGIN=http://localhost:5173
```

> ⚠️ Never commit your `.env` file. It is already included in `.gitignore`.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (or use the included `docker-compose.yml`)

---

### 1. Start PostgreSQL (via Docker)

```bash
docker-compose up -d
```

---

### 2. Backend Setup

```powershell
cd backend

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Train ML models (required on first run)
python -m app.ml.train_models

# Start the backend (auto-harvests mandi data on startup)
python -m uvicorn app.main:app --port 8001 --reload
```

The backend will automatically:
1. Initialize the database schema
2. Run the mandi dataset harvest script (pruning data older than 3 years)
3. Load the mandi CSV cache into memory (~4.5M rows)
4. Load pre-trained ML models

---

### 3. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend health check |
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/login` | Login and receive session |
| `GET` | `/api/locations?q=<query>` | Farm location autocomplete |
| `POST` | `/api/crop-decision` | ML crop recommendation ranking |
| `POST` | `/api/market-decision` | Market signal analysis |
| `POST` | `/api/expense-analysis` | Expense anomaly & budget analysis |
| `POST` | `/api/risk-analysis` | Climate + market risk scoring |
| `GET` | `/api/mandi/current` | Live mandi prices (current API) |
| `GET` | `/api/mandi/historical` | Historical mandi price trends |

---

## 🗃️ Mandi Dataset Management

FarmWise maintains a **local Agmarknet dataset** for fast analysis without repeatedly hitting external APIs.

- **Location**: `mandi_price/final_dataset.csv`
- **Size**: ~4–6 million rows (3-year sliding window)
- **Auto-managed**: On every backend startup, the dataset is:
  - Pruned to retain only the last 3 years of records
  - Updated from the remote API (from last bookmark date to today)
  - Sorted by `Arrival_Date` descending for efficient querying

To run the harvest manually:

```bash
python update_mandi_dataset.py
```

The harvest boundary is stored in `mandi_price/metadata.json` to avoid re-fetching already-downloaded records.

> ⚠️ The CSV dataset is excluded from git tracking due to its size. It is auto-populated on the first backend startup.

---

## 🔒 Authentication & Session Security

- JWT-less session model: sessions are stored in browser `localStorage`.
- Route-level guards in the frontend redirect unauthenticated users to `/auth/login`.
- Logging out clears the session from `localStorage` and prevents browser-back navigation to authenticated pages.

---

## 🧠 ML Engine

The crop intelligence engine uses:
- **RandomForestClassifier** for crop suitability scoring
- **IsolationForest** for expense anomaly detection
- Training data: `backend/app/ml/data/crop_training.csv`

To retrain models after updating training data:

```bash
cd backend
python -m app.ml.train_models
```

---

## 🐳 Docker Compose

```yaml
# Starts PostgreSQL only — backend and frontend run locally
docker-compose up -d
```

---

## 📁 Key Files

| File | Purpose |
|---|---|
| `backend/app/main.py` | App entry, lifespan hooks, cache init |
| `backend/app/config.py` | Environment variable binding |
| `backend/app/services/market_service.py` | Dual-API Agmarknet service |
| `backend/app/routes/decisions.py` | All intelligence endpoints |
| `frontend/src/App.tsx` | Client-side routing + route guards |
| `frontend/src/components/AppLayout.tsx` | Sidebar navigation layout |
| `frontend/src/pages/DashboardOverview.tsx` | Home / Farm Profile page |
| `update_mandi_dataset.py` | Standalone dataset harvest script |

---

## 📄 License

This project is for educational and research purposes.
