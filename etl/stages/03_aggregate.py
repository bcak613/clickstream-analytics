import os
import time
import duckdb
from etl import config

def run_stage_3():
    print("==================================================")
    print("STAGE 3: Pre-computing Aggregations using DuckDB")
    print("==================================================")
    start_time = time.time()
    
    # Define warehouse file paths
    categories_path = os.path.join(config.WAREHOUSE_DIR, "dim_categories.parquet")
    products_path = os.path.join(config.WAREHOUSE_DIR, "dim_products.parquet")
    users_path = os.path.join(config.WAREHOUSE_DIR, "dim_users.parquet")
    fact_events_path = os.path.join(config.WAREHOUSE_DIR, "fact_events.parquet")
    
    # Verify files exist
    for fpath in [categories_path, products_path, users_path, fact_events_path]:
        if not os.path.exists(fpath):
            raise FileNotFoundError(f"Required warehouse file not found: {fpath}. Run Stage 2 Normalization first.")
            
    # Connect to DuckDB (in-memory)
    print("Initializing DuckDB in-memory session...")
    con = duckdb.connect(database=":memory:")
    
    # Register warehouse tables as views
    con.execute(f"CREATE VIEW dim_categories AS SELECT * FROM '{categories_path}'")
    con.execute(f"CREATE VIEW dim_products AS SELECT * FROM '{products_path}'")
    con.execute(f"CREATE VIEW dim_users AS SELECT * FROM '{users_path}'")
    con.execute(f"CREATE VIEW fact_events AS SELECT * FROM '{fact_events_path}'")
    
    print("Views registered. Executing aggregations...")
    os.makedirs(config.SUMMARY_DIR, exist_ok=True)
    
    queries_dir = os.path.join(config.BASE_DIR, "queries")
    
    # Map queries to output summaries
    aggregations = {
        "overview_kpis.sql": "overview_kpis.parquet",
        "sales_trends.sql": "sales_trends.parquet",
        "brand_preferences.sql": "brand_preferences.parquet",
        "cohort_retention.sql": "cohort_retention.parquet",
        "rfm_segmentation.sql": "rfm_segmentation.parquet"
    }
    
    for qfile, outfile in aggregations.items():
        qpath = os.path.join(queries_dir, qfile)
        outpath = os.path.join(config.SUMMARY_DIR, outfile)
        
        print(f"Executing {qfile} -> {outfile}...")
        q_start = time.time()
        
        # Read SQL file
        with open(qpath, 'r', encoding='utf-8') as f:
            sql = f.read()
            
        # Execute query and copy results directly to Parquet
        copy_query = f"COPY ({sql}) TO '{outpath}' (FORMAT 'PARQUET', COMPRESSION 'SNAPPY')"
        con.execute(copy_query)
        
        q_elapsed = time.time() - q_start
        print(f"Saved {outfile} in {q_elapsed:.2f} seconds.")
        
    con.close()
    elapsed = time.time() - start_time
    print(f"Stage 3 Completed Successfully in {elapsed:.2f} seconds!")
    print("==================================================\n")

if __name__ == "__main__":
    run_stage_3()
