import * as duckdb from "@duckdb/duckdb-wasm";
import duckdb_wasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import mvp_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdb_wasm_eh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import eh_worker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";

export const TABLE = "experiments";
export const PARQUET_URL = "/experiments.parquet";

export type FacetSelection = Record<string, string[]>;

export const LIST_FACETS = [
  "organism",
  "top_organ",
  "tissue",
  "tissue_type",
  "assay",
  "disease",
  "suspension_type",
  "sex",
  "development_stage",
  "self_reported_ethnicity",
  "cell_type",
  "tissue_hierarchy_lvl0",
  "tissue_hierarchy_lvl1",
  "tissue_hierarchy_lvl2",
  "cell_type_hierarchy_lvl0",
  "cell_type_hierarchy_lvl1",
  "cell_type_hierarchy_lvl2",
] as const;

export const STRING_FACETS = ["source", "study_journal"] as const;

export type ListFacet = (typeof LIST_FACETS)[number];
export type StringFacet = (typeof STRING_FACETS)[number];
export type FacetField = ListFacet | StringFacet;

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;
let connPromise: Promise<duckdb.AsyncDuckDBConnection> | null = null;
let loadedParquet = false;

function bundles(): duckdb.DuckDBBundles {
  return {
    mvp: {
      mainModule: duckdb_wasm,
      mainWorker: mvp_worker,
    },
    eh: {
      mainModule: duckdb_wasm_eh,
      mainWorker: eh_worker,
    },
  };
}

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundle = await duckdb.selectBundle(bundles());
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return db;
    })();
  }
  return dbPromise;
}

export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!connPromise) {
    connPromise = (async () => {
      const db = await getDb();
      const conn = await db.connect();
      if (!loadedParquet) {
        const response = await fetch(PARQUET_URL);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${PARQUET_URL} (${response.status}). Run: python indexer/export_parquet.py`
          );
        }
        const buffer = new Uint8Array(await response.arrayBuffer());
        await db.registerFileBuffer("experiments.parquet", buffer);
        await conn.query(`
          CREATE OR REPLACE TABLE ${TABLE} AS
          SELECT * FROM read_parquet('experiments.parquet')
        `);
        loadedParquet = true;
      }
      return conn;
    })();
  }
  return connPromise;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlStringList(values: string[]): string {
  return `[${values.map(sqlString).join(", ")}]`;
}

export function isListFacet(field: string): field is ListFacet {
  return (LIST_FACETS as readonly string[]).includes(field);
}

/** Build AND filters. Within a facet, values are OR'd. */
export function whereClause(
  query: string,
  facets: FacetSelection,
  omitFacet?: string
): string {
  const parts: string[] = [];
  const q = query.trim();
  if (q) {
    const like = sqlString(`%${q}%`);
    parts.push(
      `(title ILIKE ${like} OR search_blob ILIKE ${like} OR coalesce(experiment_id, '') ILIKE ${like})`
    );
  }

  for (const [field, values] of Object.entries(facets)) {
    if (!values.length || field === omitFacet) continue;
    if (isListFacet(field)) {
      parts.push(`list_has_any(${field}, ${sqlStringList(values)})`);
    } else {
      parts.push(`${field} IN (${values.map(sqlString).join(", ")})`);
    }
  }

  return parts.length ? parts.join(" AND ") : "TRUE";
}

export type FacetCount = { value: string; count: number };

export async function facetCounts(
  field: FacetField,
  query: string,
  facets: FacetSelection,
  limit = 40
): Promise<FacetCount[]> {
  const conn = await getConnection();
  const where = whereClause(query, facets, field);
  const sql = isListFacet(field)
    ? `
      SELECT value, COUNT(*)::INTEGER AS count
      FROM (
        SELECT UNNEST(${field}) AS value
        FROM ${TABLE}
        WHERE ${where}
      )
      WHERE value IS NOT NULL AND value <> ''
      GROUP BY value
      ORDER BY count DESC, value
      LIMIT ${limit}
    `
    : `
      SELECT ${field} AS value, COUNT(*)::INTEGER AS count
      FROM ${TABLE}
      WHERE ${where}
        AND ${field} IS NOT NULL AND ${field} <> ''
      GROUP BY ${field}
      ORDER BY count DESC, value
      LIMIT ${limit}
    `;
  const result = await conn.query(sql);
  return result.toArray().map((row) => ({
    value: String(row.value),
    count: Number(row.count),
  }));
}

export type ExperimentRow = {
  objectID: string;
  id: string;
  title?: string;
  source?: string;
  organism?: string[];
  top_organ?: string[];
  tissue?: string[];
  assay?: string[];
  disease?: string[];
  cell_type?: string[];
  development_stage?: string[];
  suspension_type?: string[];
  cell_count?: number;
  feature_count?: number;
  explorer_url?: string;
  experiment_id?: string;
  study_journal?: string;
};

function asStringArray(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.map(String);
  // duckdb-wasm may return vector-like objects
  if (typeof value === "object" && "toArray" in (value as { toArray?: () => unknown })) {
    const arr = (value as { toArray: () => unknown[] }).toArray();
    return arr.map(String);
  }
  return [String(value)];
}

function mapRow(row: Record<string, unknown>): ExperimentRow {
  const id = String(row.id ?? "");
  return {
    objectID: id,
    id,
    title: row.title != null ? String(row.title) : undefined,
    source: row.source != null ? String(row.source) : undefined,
    organism: asStringArray(row.organism),
    top_organ: asStringArray(row.top_organ),
    tissue: asStringArray(row.tissue),
    assay: asStringArray(row.assay),
    disease: asStringArray(row.disease),
    cell_type: asStringArray(row.cell_type),
    development_stage: asStringArray(row.development_stage),
    suspension_type: asStringArray(row.suspension_type),
    cell_count: row.cell_count != null ? Number(row.cell_count) : 0,
    feature_count: row.feature_count != null ? Number(row.feature_count) : undefined,
    explorer_url: row.explorer_url != null ? String(row.explorer_url) : undefined,
    experiment_id:
      row.experiment_id != null ? String(row.experiment_id) : undefined,
    study_journal:
      row.study_journal != null ? String(row.study_journal) : undefined,
  };
}

export async function searchRows(
  query: string,
  facets: FacetSelection,
  options: { offset: number; limit: number }
): Promise<{ rows: ExperimentRow[]; found: number }> {
  const { offset, limit } = options;
  const conn = await getConnection();
  const where = whereClause(query, facets);
  const countResult = await conn.query(
    `SELECT COUNT(*)::INTEGER AS found FROM ${TABLE} WHERE ${where}`
  );
  const found = Number(countResult.toArray()[0]?.found ?? 0);
  const result = await conn.query(`
    SELECT *
    FROM ${TABLE}
    WHERE ${where}
    ORDER BY cell_count DESC, title
    LIMIT ${limit}
    OFFSET ${offset}
  `);
  const rows = result.toArray().map((row) => mapRow(row as Record<string, unknown>));
  return { rows, found };
}

export type PivotResult = {
  rows: string[];
  cols: string[];
  matrix: number[][];
  maxCell: number;
  found: number;
};

export async function pivotCounts(
  rowField: FacetField,
  colField: FacetField,
  query: string,
  facets: FacetSelection,
  options: { maxRows?: number; maxCols?: number } = {}
): Promise<PivotResult> {
  const maxRows = options.maxRows ?? 18;
  const maxCols = options.maxCols ?? 14;
  const conn = await getConnection();
  const where = whereClause(query, facets);
  const rowExpr = isListFacet(rowField)
    ? `COALESCE(UNNEST(${rowField}), '(none)')`
    : `COALESCE(NULLIF(${rowField}, ''), '(none)')`;
  const colExpr = isListFacet(colField)
    ? `COALESCE(UNNEST(${colField}), '(none)')`
    : `COALESCE(NULLIF(${colField}, ''), '(none)')`;

  // Explode multi-valued axes independently then join on id for combinations.
  const sql = `
    WITH base AS (
      SELECT * FROM ${TABLE} WHERE ${where}
    ),
    found AS (
      SELECT COUNT(*)::INTEGER AS n FROM base
    ),
    row_vals AS (
      SELECT id, ${rowExpr} AS r
      FROM base
    ),
    col_vals AS (
      SELECT id, ${colExpr} AS c
      FROM base
    ),
    pairs AS (
      SELECT r.r AS row_value, c.c AS col_value, COUNT(DISTINCT r.id)::INTEGER AS count
      FROM row_vals r
      JOIN col_vals c USING (id)
      GROUP BY 1, 2
    ),
    top_rows AS (
      SELECT row_value, SUM(count)::INTEGER AS total
      FROM pairs
      GROUP BY 1
      ORDER BY total DESC, row_value
      LIMIT ${maxRows}
    ),
    top_cols AS (
      SELECT col_value, SUM(count)::INTEGER AS total
      FROM pairs
      GROUP BY 1
      ORDER BY total DESC, col_value
      LIMIT ${maxCols}
    )
    SELECT
      p.row_value,
      p.col_value,
      p.count,
      (SELECT n FROM found) AS found
    FROM pairs p
    JOIN top_rows tr ON tr.row_value = p.row_value
    JOIN top_cols tc ON tc.col_value = p.col_value
    ORDER BY tr.total DESC, p.row_value, tc.total DESC, p.col_value
  `;

  const result = await conn.query(sql);
  const raw = result.toArray();
  const found = Number(raw[0]?.found ?? 0);
  const rowOrder: string[] = [];
  const colOrder: string[] = [];
  const seenRows = new Set<string>();
  const seenCols = new Set<string>();
  const cellMap = new Map<string, number>();

  for (const row of raw) {
    const r = String(row.row_value);
    const c = String(row.col_value);
    const count = Number(row.count);
    if (!seenRows.has(r)) {
      seenRows.add(r);
      rowOrder.push(r);
    }
    if (!seenCols.has(c)) {
      seenCols.add(c);
      colOrder.push(c);
    }
    cellMap.set(`${r}\0${c}`, count);
  }

  let maxCell = 0;
  const matrix = rowOrder.map((r) =>
    colOrder.map((c) => {
      const n = cellMap.get(`${r}\0${c}`) ?? 0;
      if (n > maxCell) maxCell = n;
      return n;
    })
  );

  return { rows: rowOrder, cols: colOrder, matrix, maxCell, found };
}
