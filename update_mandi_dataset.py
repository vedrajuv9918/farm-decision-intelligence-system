import os
import sys
import pandas as pd
import requests
from dotenv import load_dotenv

# ==============================================================================
# 1. LOAD AND VERIFY ENVIRONMENT VARIABLES
# ==============================================================================
# Try loading the .env file from the current directory, parent directory,
# or mandi_price subdirectory for maximum folder execution flexibility.
env_loaded = False
for env_path in [".env", "../.env", "mandi_price/.env"]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"[INFO] Loaded environment variables from: {env_path}")
        env_loaded = True
        break

if not env_loaded:
    load_dotenv()  # Fallback to standard system environment load
    print("[INFO] No local .env file found. Reading system environment variables.")

API_KEY = os.getenv("DATA_GOV_API_KEY_HISTORICAL") or os.getenv("DATA_GOV_API_KEY_CURRENT")
RESOURCE_ID = os.getenv("DATA_GOV_RESOURCE_ID_HISTORICAL") or os.getenv("DATA_GOV_RESOURCE_ID_CURRENT")

if not API_KEY:
    print("[ERROR] DATA_GOV_API_KEY_HISTORICAL is not defined in the environment or .env file.")
    sys.exit(1)

if not RESOURCE_ID:
    print("[ERROR] DATA_GOV_RESOURCE_ID_HISTORICAL is not defined in the environment or .env file.")
    sys.exit(1)

# ==============================================================================
# 2. CONFIGURATION & FILE PATH RESOLUTION
# ==============================================================================
# Target URL for Data.gov.in API
url = f"https://api.data.gov.in/resource/{RESOURCE_ID}"

# Search for final_dataset.csv dynamically to prevent path issues
dataset_file = None
possible_paths = [
    "final_dataset.csv",
    "mandi_price/final_dataset.csv",
    "../mandi_price/final_dataset.csv"
]

for path in possible_paths:
    if os.path.exists(path):
        dataset_file = path
        print(f"[SUCCESS] Found dataset file at: {path}")
        break

if not dataset_file:
    # If not found, default to root or mandi_price/final_dataset.csv
    if os.path.exists("mandi_price"):
        dataset_file = "mandi_price/final_dataset.csv"
    else:
        dataset_file = "final_dataset.csv"
    print(f"[WARNING] Dataset file not found in paths. Will attempt to create a new one at: {dataset_file}")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

required_columns = [
    "State",
    "District",
    "Market",
    "Commodity",
    "Arrival_Date",
    "Min_Price",
    "Max_Price",
    "Modal_Price"
]

# ==============================================================================
# 3. LOAD EXISTING DATASET
# ==============================================================================
print("\n" + "="*50)
print("LOADING EXISTING DATASET")
print("="*50)

if os.path.exists(dataset_file):
    try:
        # Load existing CSV, optimizing memory and types where possible
        print(f"[INFO] Reading {dataset_file} ... (This can take a few seconds due to file size)")
        existing_df = pd.read_csv(dataset_file, low_memory=False)
        print(f"[SUCCESS] Loaded existing dataset. Total rows: {len(existing_df):,}")
    except Exception as e:
        print(f"[ERROR] Failed to read existing dataset: {e}")
        sys.exit(1)
else:
    print(f"[INFO] Creating a fresh new dataset at {dataset_file} since it does not exist.")
    existing_df = pd.DataFrame(columns=required_columns)

# ==============================================================================
# 4. CONVERT DATES & FIND ACQUISITION ANCHOR
# ==============================================================================
import json

# Setup metadata file path in same directory as dataset_file
metadata_file = os.path.join(os.path.dirname(dataset_file) or ".", "metadata.json")

# Fast datetime conversion using YYYY-MM-DD format constraint
print("[INFO] Analyzing existing records to find the latest available date...")
existing_df["Arrival_Date"] = pd.to_datetime(
    existing_df["Arrival_Date"], 
    format="%Y-%m-%d", 
    errors="coerce"
)

# Determine the anchor date for harvesting
latest_dataset_date = None

# Attempt to load the last updated date from metadata.json
if os.path.exists(metadata_file):
    try:
        with open(metadata_file, "r") as f:
            meta = json.load(f)
            saved_date_str = meta.get("last_updated_date")
            if saved_date_str:
                latest_dataset_date = pd.to_datetime(saved_date_str, errors="coerce")
                print(f"[SUCCESS] Loaded last updated boundary date from metadata: {saved_date_str}")
    except Exception as e:
        print(f"[WARNING] Failed to read metadata.json: {e}")

# Fallback: if metadata is missing or has invalid dates, default to 3 years ago
three_years_ago = pd.Timestamp.now() - pd.DateOffset(years=3)
if pd.isnull(latest_dataset_date) or latest_dataset_date is None:
    latest_dataset_date = three_years_ago
    print(f"[INFO] Initializing harvest anchor date to 3 years ago: {latest_dataset_date.strftime('%Y-%m-%d')}")
else:
    # Ensure our anchor is not older than 3 years (keep it bounded)
    if latest_dataset_date < three_years_ago:
        latest_dataset_date = three_years_ago
        print(f"[INFO] Bound harvest anchor to 3 years ago: {latest_dataset_date.strftime('%Y-%m-%d')}")
    else:
        print(f"[SUCCESS] Harvest will fetch records starting from: {latest_dataset_date.strftime('%Y-%m-%d')}")

# ==============================================================================
# 5. FETCH NEW RECORDS FROM THE API
# ==============================================================================
print("\n" + "="*50)
print("STARTING DYNAMIC API HARVEST (OFFSET PAGINATION)")
print("="*50)

all_new_rows = []
batch_size = 5000
max_offset = 5000000  # Guardrail to prevent infinite loops

for offset in range(0, max_offset, batch_size):
    print(f"\n[BATCH] Fetching offset {offset:,} to {offset + batch_size:,}...")

    params = {
        "api-key": API_KEY,
        "format": "json",
        "limit": batch_size,
        "offset": offset,
        "sort[Arrival_Date]": "desc"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=45)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"[API ERROR] Request failed: {e}")
        print("[INFO] Gracefully stopping api loop and preserving already fetched records.")
        break
    except ValueError:
        print("[API ERROR] Failed to parse JSON response.")
        break

    records = data.get("records", [])
    if not records:
        print("[INFO] No more records returned by the API. Terminating loop.")
        break

    print(f"[INFO] API returned {len(records):,} records. Processing...")
    df = pd.DataFrame(records)

    # Clean and normalize column names (handles XML spaces and case-insensitivity)
    df.columns = df.columns.str.strip()
    
    # Standardize column mappings dynamically
    rename_map = {}
    for col in df.columns:
        col_lower = col.lower()
        if col_lower == "state":
            rename_map[col] = "State"
        elif col_lower == "district":
            rename_map[col] = "District"
        elif col_lower in ["market", "mandi"]:
            rename_map[col] = "Market"
        elif col_lower in ["commodity", "crop"]:
            rename_map[col] = "Commodity"
        elif col_lower in ["arrival_date", "date"]:
            rename_map[col] = "Arrival_Date"
        elif col_lower in ["min_price", "min_x0020_price", "minimum_price"]:
            rename_map[col] = "Min_Price"
        elif col_lower in ["max_price", "max_x0020_price", "maximum_price"]:
            rename_map[col] = "Max_Price"
        elif col_lower in ["modal_price", "modal_x0020_price"]:
            rename_map[col] = "Modal_Price"

    df.rename(columns=rename_map, inplace=True)

    # Ensure required columns are present in dataframe
    available_columns = [col for col in required_columns if col in df.columns]
    df = df[available_columns]

    # Convert API dates (expected in DD/MM/YYYY or YYYY-MM-DD from server)
    df["Arrival_Date"] = pd.to_datetime(
        df["Arrival_Date"], 
        dayfirst=True, 
        errors="coerce"
    )

    # Convert prices to float numeric representations
    for price_col in ["Min_Price", "Max_Price", "Modal_Price"]:
        if price_col in df.columns:
            df[price_col] = pd.to_numeric(df[price_col], errors="coerce")

    # Drop incomplete data row samples
    df.dropna(subset=[col for col in required_columns if col in df.columns], inplace=True)

    if df.empty:
        print("[WARNING] Batch empty after null column removal. Continuing next page...")
        continue

    # Filter only records strictly newer than our dataset anchor date
    new_df = df[df["Arrival_Date"] > latest_dataset_date]
    print(f"[INFO] New rows strictly matching filter: {len(new_df):,}")

    if len(new_df) > 0:
        all_new_rows.append(new_df)

    # --- INTELLIGENT STOP CONDITION ---
    # Since API records are sorted in descending order (newest first), the max date of
    # the batch represents the newest date. If the maximum date in this batch is already
    # older than or equal to our latest dataset date, then all remaining records in this
    # batch and all subsequent pages are guaranteed to be duplicates or older.
    oldest_date = df["Arrival_Date"].min()
    newest_date = df["Arrival_Date"].max()

    print(f"[BATCH DATE RANGE] {oldest_date.strftime('%Y-%m-%d')} to {newest_date.strftime('%Y-%m-%d')}")

    if pd.notnull(newest_date) and newest_date <= latest_dataset_date:
        print(f"\n[STOP CONDITION] Reached existing dataset boundary ({latest_dataset_date.strftime('%Y-%m-%d')}).")
        print(f"All records in offset {offset:,} are older than or equal to the dataset latest date.")
        break

# ==============================================================================
# 6. INTEGRATE, DE-DUPLICATE, AND SAVE
# ==============================================================================
print("\n" + "="*50)
print("INTEGRATING AND SAVING DATASET")
print("="*50)

# Combine new data with existing data
if len(all_new_rows) > 0:
    new_data = pd.concat(all_new_rows, ignore_index=True)
    print(f"[INFO] Total new harvested rows to merge: {len(new_data):,}")
    final_df = pd.concat([existing_df, new_data], ignore_index=True)
else:
    print("[INFO] No new rows harvested to merge.")
    final_df = existing_df

# Safely de-duplicate based on key composite unique fields
print("[INFO] Scanning for duplicate records on State-District-Market-Commodity-Arrival_Date...")
before_dup = len(final_df)
final_df.drop_duplicates(
    subset=["State", "District", "Market", "Commodity", "Arrival_Date"],
    keep="last",
    inplace=True
)
after_dup = len(final_df)
if before_dup - after_dup > 0:
    print(f"[SUCCESS] Removed {before_dup - after_dup:,} duplicate records.")

# Apply 3-year threshold retention filter
three_years_ago = pd.Timestamp.now() - pd.DateOffset(years=3)
print(f"[INFO] Filtering dataset to retain records from the last 3 years (since {three_years_ago.strftime('%Y-%m-%d')})...")
before_filter = len(final_df)
final_df = final_df[final_df["Arrival_Date"] >= three_years_ago]
after_filter = len(final_df)
print(f"[SUCCESS] Removed {before_filter - after_filter:,} records older than 3 years.")

# Format the Arrival_Date strictly back to YYYY-MM-DD string representation
final_df["Arrival_Date"] = final_df["Arrival_Date"].dt.strftime("%Y-%m-%d")

# Sort final dataset by date descending and then by states
print("[INFO] Sorting updated dataset by date descending and states ascending...")
final_df.sort_values(by=["Arrival_Date", "State"], ascending=[False, True], inplace=True)

# Save to disk with proper UTF-8 encoding
print(f"[INFO] Writing updated dataset back to {dataset_file}...")
try:
    final_df.to_csv(dataset_file, index=False, encoding="utf-8")
    print(f"\n[SUCCESS] Mandi dataset updated and saved successfully!")
    print(f"-> Location: {dataset_file}")
    print(f"-> Original Rows: {len(existing_df):,}")
    print(f"-> Added New Rows: {len(final_df) - len(existing_df) + (before_filter - after_filter):,}")
    print(f"-> Final Total Rows: {len(final_df):,}")
except Exception as e:
    print(f"[ERROR] Failed to save updated dataset to disk: {e}")

# Save the latest date of the updated dataset to metadata.json as the last updated boundary
max_date_str = final_df["Arrival_Date"].max()
if pd.notnull(max_date_str):
    try:
        with open(metadata_file, "w") as f:
            json.dump({"last_updated_date": max_date_str}, f)
        print(f"[SUCCESS] Saved last updated boundary date to metadata: {max_date_str}")
    except Exception as e:
        print(f"[ERROR] Failed to save metadata file: {e}")
