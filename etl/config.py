import os

# Base Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# Source Data Paths
CSV_PATH = os.path.join(PROJECT_ROOT, "01-log-tracking.csv")

# Data Warehouse Paths
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
WAREHOUSE_DIR = os.path.join(DATA_DIR, "warehouse")
SUMMARY_DIR = os.path.join(DATA_DIR, "summary")

# Target Output Files
RAW_PARQUET_PATH = os.path.join(RAW_DIR, "events_raw.parquet")

# Ensure necessary directories exist
for directory in [RAW_DIR, WAREHOUSE_DIR, SUMMARY_DIR]:
    os.makedirs(directory, exist_ok=True)
