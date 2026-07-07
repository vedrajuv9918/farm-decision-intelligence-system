# Mandi Dataset Auto-Updater: Integration & Execution Manual

This document details the configuration, architecture, execution steps, and future scalability path for the `update_mandi_dataset.py` system.

---

## 1. Project Directory Structure

Here is how the newly added file fits into your FarmWise workspace architecture:

```text
farmwise/
├── .env                         # Local environment configuration file (API Keys, DB config)
├── .env.example                 # Example configuration template
├── update_mandi_dataset.py      # [NEW] Production-style incremental Mandi harvester
├── mandi_price/
│   ├── final_dataset.csv        # Massive historical Mandi dataset (~597 MB, 7M+ rows)
│   └── missing_apr_may_2026.csv # Historical patch file
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI server entry point
│   │   ├── routes/
│   │   └── services/
└── frontend/
    ├── src/
    └── vite.config.ts           # Frontend development proxy config
```

---

## 2. Environment Configurations (`.env`)

Ensure your `.env` contains the required keys. A matching template is maintained in your `.env.example`:

```ini
# OpenWeather Map API for weather risk analytics
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Data.gov.in / Agmarknet Mandi API Config
DATA_GOV_API_KEY=your_datagov_api_key_here
DATA_GOV_RESOURCE_ID=35985678-0d79-46b4-9ed6-6f13308a1d24

# Core Application Configs
DATABASE_URL=sqlite+aiosqlite:///./farmwise.db
FRONTEND_ORIGIN=http://localhost:5173
```

---

## 3. Step-by-Step Execution Guide

### Step 1: Initialize Virtual Environment & Install Dependencies
Open your command terminal at the project root `d:\farmwise` and ensure the required packages are present in your python environment:
```powershell
# Activate your existing python virtual environment
.\.venv\Scripts\Activate.ps1

# Install required numerical, data manipulation, and web libraries
pip install pandas requests python-dotenv
```

### Step 2: Dry Run or Run Data Updates
Execute the updater script directly from the project root:
```powershell
python update_mandi_dataset.py
```

---

## 4. Expected Console Log Output

When running, the script prints clear, structured, and informative details about each harvesting phase:

```text
[INFO] Loaded environment variables from: .env

==================================================
LOADING EXISTING DATASET
==================================================
[SUCCESS] Found dataset file at: mandi_price/final_dataset.csv
[INFO] Reading mandi_price/final_dataset.csv ... (This can take a few seconds due to file size)
[SUCCESS] Loaded existing dataset. Total rows: 7,070,021
[INFO] Analyzing existing records to find the latest available date...
[SUCCESS] Latest date in existing dataset: 2026-05-16

==================================================
STARTING DYNAMIC API HARVEST (OFFSET PAGINATION)
==================================================

[BATCH] Fetching offset 0 to 5,000...
[INFO] API returned 5,000 records. Processing...
[INFO] New rows strictly matching filter: 3,450
[BATCH DATE RANGE] 2026-05-14 to 2026-05-18

[BATCH] Fetching offset 5,000 to 10,000...
[INFO] API returned 5,000 records. Processing...
[INFO] New rows strictly matching filter: 1,220
[BATCH DATE RANGE] 2026-05-11 to 2026-05-15

[BATCH] Fetching offset 10,000 to 15,000...
[INFO] API returned 5,000 records. Processing...
[INFO] New rows strictly matching filter: 0
[BATCH DATE RANGE] 2026-05-09 to 2026-05-13

[STOP CONDITION] Reached existing dataset boundary (2026-05-16).
All records in offset 10,000 are older than or equal to the dataset latest date.

==================================================
INTEGRATING AND SAVING DATASET
==================================================
[INFO] Total new harvested rows to merge: 4,670
[INFO] Scanning for duplicate records on State-District-Market-Commodity-Arrival_Date...
[SUCCESS] Removed 1,210 duplicate records.
[INFO] Sorting updated dataset...
[INFO] Writing updated dataset back to mandi_price/final_dataset.csv...

[SUCCESS] Mandi dataset updated successfully!
-> Location: mandi_price/final_dataset.csv
-> Original Rows: 7,070,021
-> Added New Rows: 3,460
-> Final Total Rows: 7,073,481
```

---

## 5. Architectural Improvements in the Code

This production implementation provides critical safety and speed enhancements over naive scripting structures:

1. **Intelligent Search Path Resolution**: Automatically scans parent, sibling, and sub-folders to find `final_dataset.csv` and `.env` regardless of the folder from which you call `python update_mandi_dataset.py`.
2. **Robust Case-Insensitive Column Renaming**: Protects against unexpected XML encoding spaces (e.g. `Min_x0020_Price`) and lowercase letters returned by different iterations of Government database endpoints.
3. **Advanced Boundary Stopping Logic**: Naive scripts stop immediately if a single record's date drops below the anchor. Our script checks if the *batch's maximum date* is below the threshold, ensuring no new arrivals on pagination margins are missed.
4. **Clean String Formatting for CSV Serialization**: Formats dates explicitly back to `%Y-%m-%d` before writing to CSV, avoiding standard pandas time offsets that bloat CSV file sizes.

---

## 6. Future Scalability Suggestions

As your platform scales to support larger user requests and high-concurrency analytics, implement these structural advancements:

* **Database Migration**: Move `final_dataset.csv` into a PostgreSQL database with a composite unique index on `(State, District, Market, Commodity, Arrival_Date)` and cluster index on `(Commodity, Arrival_Date)`. This speeds up dynamic dashboards from seconds to milliseconds.
* **Cron/Task Automation (Airflow or Celery)**: Setup this script as an overnight scheduled job (e.g. daily cron at 2 AM) since mandi records are refreshed by data.gov.in daily.
* **Chunked Merging**: If system RAM becomes a constraint, modify the script to process the CSV in chunk sizes or streams rather than loading the full 597MB into memory.
