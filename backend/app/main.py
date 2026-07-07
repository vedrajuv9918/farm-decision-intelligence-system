from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes import auth, decisions, health, locations
from app.services.auth_service import init_auth_db

from contextlib import asynccontextmanager
from pathlib import Path
import subprocess
import sys

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):

    # =========================================================
    # 1. UPDATE MANDI DATASET AUTOMATICALLY
    # =========================================================

    print("\n========================================")
    print("Updating mandi dataset...")
    print("========================================")

    # Project root directory
    ROOT_DIR = Path(__file__).resolve().parent.parent.parent

    # update_mandi_dataset.py path
    script_path = ROOT_DIR / "update_mandi_dataset.py"

    if script_path.exists():

        try:

            # Run dataset updater script
            result = subprocess.run(
                [sys.executable, str(script_path)],
                cwd=str(ROOT_DIR),
                capture_output=True,
                text=True,
                timeout=300
            )

            # =========================================
            # SUCCESS
            # =========================================

            if result.returncode == 0:

                print("\nDataset update completed successfully")

                # Show update script logs
                if result.stdout:
                    print("\n========== UPDATE LOG ==========")
                    print(result.stdout)

            # =========================================
            # FAILURE
            # =========================================

            else:

                print("\nDataset update failed")

                print(f"\nReturn Code: {result.returncode}")

                if result.stderr:
                    print("\n========== ERROR LOG ==========")
                    print(result.stderr)

        # =========================================
        # TIMEOUT
        # =========================================

        except subprocess.TimeoutExpired:

            print(
                "\nDataset update failed "
                "(Timeout exceeded)"
            )

        # =========================================
        # UNKNOWN ERROR
        # =========================================

        except Exception as e:

            print("\nDataset update failed")

            print(f"\nError: {e}")

    else:

        print(
            "\nupdate_mandi_dataset.py "
            f"not found at:\n{script_path}"
        )

    print("\nContinuing backend startup...")

    # =========================================================
    # 2. INITIALIZE DATABASES
    # =========================================================

    print("\nInitializing databases...")

    # SQLite auth database
    try:

        init_auth_db()

        print("Auth database initialized")

    except Exception as e:

        print("Auth DB initialization failed")

        print(e)

    # SQLAlchemy database
    try:

        from app.db import init_db

        await init_db()

        print("Application database initialized")

    except Exception as e:

        print("App DB initialization skipped")

        print(e)

    # =========================================================
    # 3. LOAD / TRAIN ML MODELS
    # =========================================================

    print("\nLoading mandi dataset cache...")

    try:

        from app.services.history_service import HistoryService

        rows = len(HistoryService().dataframe())

        print(f"Mandi dataset cache ready ({rows:,} rows)")

    except Exception as e:

        print("Mandi dataset cache loading skipped")

        print(e)

    print("\nLoading ML models...")

    try:

        from app.ml.train_models import ensure_models

        ensure_models()

        print("ML models ready")

    except Exception as e:

        print("ML model loading skipped")

        print(e)

    # =========================================================
    # FASTAPI STARTS HERE
    # =========================================================

    print("\n========================================")
    print("FarmWise Backend Started Successfully")
    print("========================================\n")

    yield


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="FarmWise API",
    description=(
        "AI-powered agriculture decisions using "
        "real weather, mandi data, ML, "
        "and risk intelligence."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "https://myfarmwise.vercel.app",
        settings.frontend_origin,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# ROOT ROUTE
# =========================================================

@app.get("/")
async def root() -> dict:

    return {
        "status": "ok",
        "service": settings.app_name,
        "message": (
            "FarmWise API is running. "
            "Open /docs for the interactive API explorer."
        ),
        "routes": [
            "GET  /api/health",
            "POST /auth/register",
            "POST /api/auth/login",
            "POST /api/auth/farm-profile",
            "GET  /api/locations",
            "POST /api/crop-decision",
            "POST /api/market-decision",
            "POST /api/mandi-prices",
            "POST /api/mandi-options",
            "POST /api/expense-analysis",
            "POST /api/risk-analysis",
        ],
    }

# =========================================================
# ROUTERS
# =========================================================

app.include_router(health.router, prefix="/api")

app.include_router(auth.router, prefix="/api")

app.include_router(locations.router, prefix="/api")

app.include_router(decisions.router, prefix="/api")
