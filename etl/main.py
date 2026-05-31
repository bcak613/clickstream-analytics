import sys
import time
import argparse
import importlib

def main():
    parser = argparse.ArgumentParser(description="Clickstream Analytics platform ETL & Aggregations")
    # Fix argparse option adding
    parser.add_argument("--stage", type=int, choices=[1, 2, 3], help="ETL stage to run (1, 2, or 3)")
    
    args = parser.parse_args()
    
    start_time = time.time()
    
    # Defaults to running all stages
    run_all = args.stage is None
    
    try:
        if run_all or args.stage == 1:
            stage_01 = importlib.import_module("etl.stages.01_raw_ingest")
            stage_01.run_stage_1()
            
        if run_all or args.stage == 2:
            stage_02 = importlib.import_module("etl.stages.02_normalize")
            stage_02.run_stage_2()
            
        if run_all or args.stage == 3:
            stage_03 = importlib.import_module("etl.stages.03_aggregate")
            stage_03.run_stage_3()
            
        total_time = time.time() - start_time
        print(f"Total ETL Execution Time: {total_time:.2f} seconds.")
        
    except Exception as e:
        print(f"ETL Execution Failed: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
