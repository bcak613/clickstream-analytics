import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // 1. Select the bundle matching browser capabilities
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    // 2. Create the worker thread
    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();

    // 3. Instantiate the async DuckDB database
    const instance = new duckdb.AsyncDuckDB(logger, worker);
    await instance.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    URL.revokeObjectURL(worker_url);
    db = instance;
    return db;
  })();

  return dbPromise;
}

function bigintToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(bigintToNumber);
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key] = bigintToNumber(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

export async function queryDuckDB(database: duckdb.AsyncDuckDB, sql: string): Promise<any[]> {
  const conn = await database.connect();
  try {
    const arrowResult = await conn.query(sql);
    // Convert Arrow table directly into standard JS array of objects
    const rows = arrowResult.toArray().map((row) => row.toJSON());
    // Universally convert any BigInt values to standard JS numbers
    return bigintToNumber(rows);
  } finally {
    await conn.close();
  }
}

export async function loadParquet(database: duckdb.AsyncDuckDB, url: string, tableName: string): Promise<void> {
  // Register summary Parquet static asset as file
  await database.registerFileURL(
    tableName,
    url,
    duckdb.DuckDBDataProtocol.HTTP,
    false
  );
  
  // Create virtual view referencing the file so it can be queried by name in SQL
  const conn = await database.connect();
  try {
    await conn.query(`CREATE OR REPLACE VIEW ${tableName} AS SELECT * FROM read_parquet('${tableName}')`);
  } finally {
    await conn.close();
  }
}
