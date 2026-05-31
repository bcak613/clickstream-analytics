import os
import time
import polars as pl
from etl import config

def run_stage_1():
    print("==================================================")
    print("STAGE 1: Ingesting Raw Clickstream CSV to Parquet")
    print("==================================================")
    start_time = time.time()
    
    if not os.path.exists(config.CSV_PATH):
        raise FileNotFoundError(f"Source CSV not found at {config.CSV_PATH}. Please place 01-log-tracking.csv in the project root.")
        
    print(f"Scanning lazily from: {config.CSV_PATH}")
    
    # 1. Define lazy CSV scan with precise schemas
    lf = pl.scan_csv(
        config.CSV_PATH,
        schema={
            "event_time": pl.String,
            "event_type": pl.String,
            "product_id": pl.Int64,
            "category_id": pl.Int64,
            "category_code": pl.String,
            "brand": pl.String,
            "price": pl.Float64,
            "user_id": pl.Int64,
            "user_session": pl.String
        },
        null_values=["", "NA", "null", "NULL"]
    )
    
    # 2. Sink directly to Parquet (streaming ingestion)
    print(f"Streaming and writing to compressed Parquet: {config.RAW_PARQUET_PATH}")
    
    # Ensure raw directory exists
    os.makedirs(config.RAW_DIR, exist_ok=True)
    
    # Sink to parquet
    lf.sink_parquet(config.RAW_PARQUET_PATH, compression="snappy")
    
    elapsed = time.time() - start_time
    print(f"Stage 1 Completed Successfully in {elapsed:.2f} seconds!")
    
    # 3. Read metadata count to verify completeness
    metadata = pl.read_parquet_schema(config.RAW_PARQUET_PATH)
    # Get row count quickly
    df_meta = pl.read_parquet(config.RAW_PARQUET_PATH, n_rows=1)
    print(f"Output schema: {metadata}")
    print("==================================================\n")

if __name__ == "__main__":
    run_stage_1()
