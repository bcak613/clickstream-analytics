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

    # --------------------------------------------------
    # DATA QUALITY: Cast event_time to Datetime & filter
    # --------------------------------------------------
    # FIX 1: Ép kiểu event_time từ String → Datetime với timezone UTC
    #         Nếu để String, .min()/.max() so sánh lexicographic thay vì chronological.
    #         Polars tự raise lỗi nếu format không đúng → phát hiện format lẫn lộn sớm.
    lf = lf.with_columns([
        pl.col("event_time")
          .str.to_datetime(format="%Y-%m-%d %H:%M:%S %Z", strict=False, use_earliest=True)
          .alias("event_time")
    ])

    # FIX 2: Lọc bỏ bản ghi có price âm hoặc bằng 0 (lỗi hệ thống TMDT)
    #         Chỉ áp dụng cho sự kiện purchase — view/cart không nhất thiết cần price > 0
    lf = lf.filter(
        (pl.col("event_type") != "purchase") | (pl.col("price") > 0)
    )

    # FIX 3: Loại trùng lặp click đúp / Bot traffic trong fact_events
    #         Hai sự kiện giống hệt nhau (cùng user, session, product, event_type, giây) → giữ 1
    lf = lf.unique(
        subset=["user_id", "user_session", "product_id", "event_type", "event_time"],
        keep="first"
    )

    # Ensure warehouse directory exists
    os.makedirs(config.WAREHOUSE_DIR, exist_ok=True)
    
    # --------------------------------------------------
    # 1. Normalize Categories Table (dim_categories)
    # --------------------------------------------------
    print("Normalizing dim_categories...")
    
    categories_df = lf.select(["category_id", "category_code"]).unique(subset=["category_id"]).collect()
    
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
    
    # first_seen giờ so sánh đúng vì event_time đã là Datetime
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
    
    products_raw = lf.select(["product_id", "brand", "category_id", "price", "event_time"])
    
    products_raw = products_raw.with_columns([
        pl.col("brand").fill_null("unknown")
    ])
    
    # FIX 4: Dedup log rác cùng mức giá trước khi group_by → tránh sinh dòng SCD thừa
    #         Ví dụ: cùng product_id + price xuất hiện 100 lần trong cùng ngày → chỉ giữ min event_time
    products_scd = products_raw.group_by(["product_id", "brand", "category_id", "price"]).agg([
        pl.col("event_time").min().alias("valid_from")
    ]).sort(["product_id", "valid_from"])
    
    products_scd_df = products_scd.collect()

    # Sau khi sort, loại bỏ các dòng có cùng product_id + price liên tiếp (SCD fragment thừa)
    # trước khi dùng shift để tính valid_to
    products_scd_df = products_scd_df.unique(
        subset=["product_id", "price"],
        keep="first"
    ).sort(["product_id", "valid_from"])
    
    # valid_to = valid_from của dòng kế tiếp. Dòng cuối cùng (giá hiện tại) = far future
    products_scd_df = products_scd_df.with_columns([
        pl.col("valid_from")
          .shift(-1)
          .over("product_id")
          .fill_null(pl.lit("2099-12-31").str.to_datetime(format="%Y-%m-%d"))
          .alias("valid_to")
    ])
    
    products_path = os.path.join(config.WAREHOUSE_DIR, "dim_products.parquet")
    products_scd_df.write_parquet(products_path, compression="snappy")
    print(f"Written dim_products (SCD Type 2): {products_scd_df.height} rows")
    
    # --------------------------------------------------
    # 4. Normalize Fact Events Table (fact_events)
    # --------------------------------------------------
    print("Normalizing fact_events...")
    
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
