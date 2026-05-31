'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
import { initDuckDB, queryDuckDB, loadParquet } from '@/lib/duckdb';

interface DuckDBContextType {
  db: AsyncDuckDB | null;
  loading: boolean;
  error: string | null;
  query: (sql: string) => Promise<any[]>;
}

const DuckDBContext = createContext<DuckDBContextType>({
  db: null,
  loading: true,
  error: null,
  query: async () => [],
});

export const useDuckDB = () => useContext(DuckDBContext);

// Separate lightweight context for perf stats to avoid re-rendering the full tree
export interface QueryStat {
  sql: string;
  rowCount: number;
  durationMs: number;
  timestamp: number;
}

interface DuckDBPerfContextType {
  lastQueryMs: number | null;
  totalQueriesRun: number;
  queryStats: QueryStat[];
}

const DuckDBPerfContext = createContext<DuckDBPerfContextType>({
  lastQueryMs: null,
  totalQueriesRun: 0,
  queryStats: [],
});

export const useDuckDBPerf = () => useContext(DuckDBPerfContext);

export const DuckDBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AsyncDuckDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Performance tracking state
  const [lastQueryMs, setLastQueryMs] = useState<number | null>(null);
  const [totalQueriesRun, setTotalQueriesRun] = useState(0);
  const [queryStats, setQueryStats] = useState<QueryStat[]>([]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        console.log('Bootstrapping DuckDB-WASM...');
        const database = await initDuckDB();
        
        if (!active) return;

        // Register Summary Parquet static files as views
        const tables = [
          { name: 'overview_kpis', url: '/data/overview_kpis.parquet' },
          { name: 'sales_trends', url: '/data/sales_trends.parquet' },
          { name: 'brand_preferences', url: '/data/brand_preferences.parquet' },
          { name: 'cohort_retention', url: '/data/cohort_retention.parquet' },
          { name: 'rfm_segmentation', url: '/data/rfm_segmentation.parquet' }
        ];

        for (const table of tables) {
          console.log(`Loading summary Parquet table: ${table.name}...`);
          // Ensure we hit the root-relative path in Next.js public/
          const absoluteUrl = window.location.origin + table.url;
          await loadParquet(database, absoluteUrl, table.name);
        }

        if (active) {
          setDb(database);
          setLoading(false);
          console.log('DuckDB-WASM Bootstrapped & Data Loaded successfully!');
        }
      } catch (err: any) {
        console.error('Failed to initialize DuckDB-WASM:', err);
        if (active) {
          setError(err.message || 'Failed to initialize analytics engine.');
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const query = useCallback(async (sql: string): Promise<any[]> => {
    if (!db) {
      throw new Error('DuckDB not initialized.');
    }
    const t0 = performance.now();
    const result = await queryDuckDB(db, sql);
    const durationMs = Math.round(performance.now() - t0);

    // Update perf state — using functional updaters avoids needing these
    // setters in the dependency array (they are stable by React guarantee)
    setLastQueryMs(durationMs);
    setTotalQueriesRun(prev => prev + 1);
    setQueryStats(prev => {
      const stat: QueryStat = {
        sql: sql.trim().slice(0, 80),
        rowCount: result.length,
        durationMs,
        timestamp: Date.now(),
      };
      // Keep last 20 stats
      return [stat, ...prev].slice(0, 20);
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]); // Only re-create when the DuckDB instance itself changes (once)

  return (
    <DuckDBContext.Provider value={{ db, loading, error, query }}>
      <DuckDBPerfContext.Provider value={{ lastQueryMs, totalQueriesRun, queryStats }}>
        {children}
      </DuckDBPerfContext.Provider>
    </DuckDBContext.Provider>
  );
};
