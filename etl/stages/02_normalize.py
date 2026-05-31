import os
import time
import polars as pl
from etl import config

def run_stage_2():
    print("==================================================")
    print("STAGE 2: Normalizing Raw Data into 3NF Warehouse")
    print("==================================================")
    start_time = time.time()
    
    if not os.path.exists(config.RAW_PARQUET_PATH):
        raise FileNotFoundError(f"Raw Parquet file not found at {config.RAW_PARQUET_PATH}. Run Stage 1 Ingestion first.")
        
    print(f"Loading raw Parquet lazily from: {config.RAW_PARQUET_PATH}")
    lf = pl.scan_parquet(config.RAW_PARQUET_PATH)
    
    # Ensure warehouse directory exists
    os.makedirs(config.WAREHOUSE_DIR, exist_ok=True)
    
    # --------------------------------------------------
    # 1. Normalize Categories Table (dim_categories)
    # --------------------------------------------------
    print("Normalizing dim_categories...")
    
    # Get unique combinations of category_id and category_code
    categories_df = lf.select(["category_id", "category_code"]).unique(subset=["category_id"]).collect()
    
    # Split category_code hierarchy: split on '.' and take up to 2 levels
    categories_df = categories_df.with_columns([
        pl.col("category_code").fill_null("unknown").alias("category_code_filled")
    ]).with_columns([
        pl.col("category_code_filled").str.splitn(".", 2).struct.field("field_0").alias("category_level_1"),
        pl.col("category_code_filled").str.splitn(".", 2).struct.field("field_1").fill_null("unknown").alias("category_level_2")
    ]).drop("category_code_filled")
    
    categories_path = os.path.join(config.WAREHOUSE_DIR, "dim_categories.parquet")
    categories_df.write_parquet(categories_path, compression="snappy")
    print(f"Written dim_categories: {categories_df.height} rows")
    
    # --------------------------------------------------
    # 2. Normalize Users Table (dim_users)
    # --------------------------------------------------
    print("Normalizing dim_users...")
    
    # Group by user_id to compute first_seen (min event_time) and session_count (n_unique user_session)
    users_df = lf.group_by("user_id").agg([
        pl.col("event_time").min().alias("first_seen"),
        pl.col("user_session").n_unique().alias("session_count")
    ]).collect()
    
    users_path = os.path.join(config.WAREHOUSE_DIR, "dim_users.parquet")
    users_df.write_parquet(users_path, compression="snappy")
    print(f"Written dim_users: {users_df.height} rows")
    
    # --------------------------------------------------
    # 3. Normalize Products Table (dim_products - SCD Type 2)
    # --------------------------------------------------
    print("Normalizing dim_products (SCD Type 2 Price Tracking)...")
    
    # Get product references (product_id, brand, category_id, price, event_time)
    # Group by product_id, brand, category_id, and price to find valid_from (min event_time)
    products_raw = lf.select(["product_id", "brand", "category_id", "price", "event_time"])
    
    # Fill brand nulls with 'unknown'
    products_raw = products_raw.with_columns([
        pl.col("brand").fill_null("unknown")
    ])
    
    products_scd = products_raw.group_by(["product_id", "brand", "category_id", "price"]).agg([
        pl.col("event_time").min().alias("valid_from")
    ]).sort(["product_id", "valid_from"])
    
    # Collect to compute valid_to using shift
    products_scd_df = products_scd.collect()
    
    # valid_to is the next price's valid_from. For the latest price, set to 2099 far-future
    products_scd_df = products_scd_df.with_columns([
        pl.col("valid_from").shift(-1).over("product_id").fill_null("2099-12-31 23:59:59 UTC").alias("valid_to")
    ])
    
    products_path = os.path.join(config.WAREHOUSE_DIR, "dim_products.parquet")
    products_scd_df.write_parquet(products_path, compression="snappy")
    print(f"Written dim_products (SCD Type 2): {products_scd_df.height} rows")
    
    # --------------------------------------------------
    # 4. Normalize Fact Events Table (fact_events)
    # --------------------------------------------------
    print("Normalizing fact_events...")
    
    # The fact events contains foreign keys to dimension tables, plus timestamps and event types.
    # We select event_time, event_type, product_id, category_id, user_id, and user_session.
    facts_df = lf.select([
        "event_time",
        "event_type",
        "product_id",
        "category_id",
        "user_id",
        "user_session"
    ]).collect()
    
    facts_path = os.path.join(config.WAREHOUSE_DIR, "fact_events.parquet")
    facts_df.write_parquet(facts_path, compression="snappy")
    print(f"Written fact_events: {facts_df.height} rows")
    
    elapsed = time.time() - start_time
    print(f"Stage 2 Completed Successfully in {elapsed:.2f} seconds!")
    print("==================================================\n")

if __name__ == "__main__":
    run_stage_2()
