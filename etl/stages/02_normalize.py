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
    print("[1/4] dim_categories...")
    
    categories_df = lf.select(["category_id", "category_code"]).unique(subset=["category_id"]).collect()
    
    categories_df = categories_df.with_columns([
        pl.col("category_code").fill_null("unknown").alias("category_code_filled")
    ]).with_columns([
        pl.col("category_code_filled").str.splitn(".", 2).struct.field("field_0").alias("category_level_1"),
        pl.col("category_code_filled").str.splitn(".", 2).struct.field("field_1").fill_null("unknown").alias("category_level_2")
    ]).drop("category_code_filled")
    
    categories_path = os.path.join(config.WAREHOUSE_DIR, "dim_categories.parquet")
    categories_df.write_parquet(categories_path, compression="snappy")
    print(f"    -> {categories_df.height:,} rows  ({time.time()-start_time:.1f}s)")
    
    # --------------------------------------------------
    # 2. Normalize Users Table (dim_users)
    # --------------------------------------------------
    print("[2/4] dim_users...")
    
    users_df = lf.group_by("user_id").agg([
        pl.col("event_time").min().alias("first_seen"),
        pl.col("user_session").n_unique().alias("session_count")
    ]).collect()
    
    users_path = os.path.join(config.WAREHOUSE_DIR, "dim_users.parquet")
    users_df.write_parquet(users_path, compression="snappy")
    print(f"    -> {users_df.height:,} rows  ({time.time()-start_time:.1f}s)")
    
    # --------------------------------------------------
    # 3. Normalize Products Table (dim_products - SCD Type 2)
    # --------------------------------------------------
    print("[3/4] dim_products (SCD Type 2)...")
    
    products_raw = lf.select(["product_id", "brand", "category_id", "price", "event_time"])
    products_raw = products_raw.with_columns([
        pl.col("brand").fill_null("unknown")
    ])
    
    products_scd = products_raw.group_by(["product_id", "brand", "category_id", "price"]).agg([
        pl.col("event_time").min().alias("valid_from")
    ]).sort(["product_id", "valid_from"])
    
    products_scd_df = products_scd.collect()

    # FIX: Dedup same product+price fragments trước shift
    # Tránh SCD sinh dòng phân mảnh thừa khi giá không đổi
    products_scd_df = products_scd_df.unique(
        subset=["product_id", "price"],
        keep="first"
    ).sort(["product_id", "valid_from"])
    
    products_scd_df = products_scd_df.with_columns([
        pl.col("valid_from").shift(-1).over("product_id").fill_null("2099-12-31 23:59:59 UTC").alias("valid_to")
    ])
    
    products_path = os.path.join(config.WAREHOUSE_DIR, "dim_products.parquet")
    products_scd_df.write_parquet(products_path, compression="snappy")
    print(f"    -> {products_scd_df.height:,} rows  ({time.time()-start_time:.1f}s)")
    
    # --------------------------------------------------
    # 4. Normalize Fact Events Table (fact_events)
    # --------------------------------------------------
    print("[4/4] fact_events...")
    
    # FIX: Lọc purchase có price <= 0 (lỗi hệ thống TMDT phổ biến)
    facts_df = lf.filter(
        (pl.col("event_type") != "purchase") | (pl.col("price") > 0)
    ).select([
        "event_time",
        "event_type",
        "product_id",
        "category_id",
        "user_id",
        "user_session"
    ]).collect()
    
    facts_path = os.path.join(config.WAREHOUSE_DIR, "fact_events.parquet")
    facts_df.write_parquet(facts_path, compression="snappy")
    print(f"    -> {facts_df.height:,} rows  ({time.time()-start_time:.1f}s)")
    
    elapsed = time.time() - start_time
    print(f"\nStage 2 Completed in {elapsed:.1f}s")
    print("==================================================\n")

if __name__ == "__main__":
    run_stage_2()
