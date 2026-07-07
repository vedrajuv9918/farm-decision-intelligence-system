# FarmWise

Smart Farming Decisions Powered by AI & Real-Time Data

FarmWise is a production-oriented intelligent agriculture platform that combines live weather, live mandi prices, ML profitability scoring, expense intelligence, and risk analysis into farmer-friendly recommendations.

## Stack

- Backend: FastAPI, async `httpx`, Pydantic, SQLAlchemy async, PostgreSQL
- ML: scikit-learn RandomForest, IsolationForest, LogisticRegression-compatible preprocessing
- Frontend: React, TypeScript, Vite, TailwindCSS, Recharts, MUI Autocomplete
- Data sources: OpenWeather, data.gov.in Agmarknet, OpenStreetMap Nominatim

## Quick Start

1. Copy environment variables:

```powershell
Copy-Item .env.example .env
```

2. Fill `.env` with your API keys:

```env
OPENWEATHER_API_KEY=your_openweather_key
DATA_GOV_API_KEY=your_data_gov_key
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/farmwise
```

3. Start the backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.ml.train_models
uvicorn app.main:app --reload
```

4. Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

5. Open `http://localhost:5173`.

## API Routes

- `GET /health`
- `GET /locations?q=bang`
- `POST /crop-decision`
- `POST /market-decision`
- `POST /expense-analysis`
- `POST /risk-analysis`

## Notes

- FarmWise does not hardcode crop recommendations. The crop engine ranks any crop present in the training dataset and enriches decisions with live weather and market context.
- Live API failures are returned as actionable service errors instead of silently fabricating data.
- The ML training dataset is structured and versioned under `backend/app/ml/data/crop_training.csv`; retrain with `python -m app.ml.train_models`.
