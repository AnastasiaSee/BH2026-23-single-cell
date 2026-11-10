# Unified experiment explore stack (Fenix + Single Cell Portal)

**Primary path: client-side Parquet + DuckDB-WASM** (no search server).

Catalogs:

- [`WP1/fenix/experiments.json`](../fenix/experiments.json) → `source=fenix`
- [`WP1/single_cell_portal/studies.json`](../single_cell_portal/studies.json) → `source=single_cell_portal`

| Piece | Role |
|-------|------|
| **Python exporter** | Flattens both catalogs (+ OLS tissue/cell-type hierarchy) → `ui/public/experiments.parquet` |
| **React + Vite + DuckDB-WASM** | Search, facets, Cards/Table/Pivot entirely in the browser |
| **Typesense + FastAPI** *(optional / legacy)* | Still available under `docker-compose` / `api/` if you want InstantSearch or MCP stubs |

## Prerequisites

- Python 3.11+ (Parquet export)
- Node.js 20+ (UI)
- Catalogs:
  - Fenix: `python3 WP1/fenix/download_experiments.py` (or use the cached file)
  - SCP: `python3 WP1/single_cell_portal/download_studies.py --summarize`

## Quick start (Parquet + DuckDB only)

```bash
cd WP1/explore

# 1) Flatten catalogs → Parquet (uses on-disk OLS caches when present)
python3 -m venv .venv
source .venv/bin/activate
pip install -r indexer/requirements.txt
python indexer/export_parquet.py
# → ui/public/experiments.parquet (~1 MiB for 1500 rows)

# 2) UI
cd ui
npm install
npm run dev
# → http://127.0.0.1:5173
```

Open the UI (or Cursor Try Live on port 5173). The browser downloads the Parquet file and runs DuckDB-WASM locally — no Typesense, no FastAPI, no API keys.

### Refresh data

```bash
python indexer/export_parquet.py          # reuse OLS cache
python indexer/export_parquet.py --refresh-ols   # re-query OLS
```

## What is in the Parquet file

Same flattened document shape as the Typesense indexer (namespaced ids, `source`, facet lists, `search_blob`, cell counts, explorer URLs), with hierarchy columns renamed for SQL:

| InstantSearch-style field | Parquet / DuckDB column |
|---------------------------|-------------------------|
| `tissue_hierarchy.lvl0…5` | `tissue_hierarchy_lvl0…5` |
| `cell_type_hierarchy.lvl0…5` | `cell_type_hierarchy_lvl0…5` |

Facet values are case-normalized at export time (`canonicalize_facet_value`).

### Tissue & cell-type hierarchy (OLS)

Export resolves tissues (UBERON) and cell types (CL) via [EBI OLS4](https://www.ebi.ac.uk/ols4/) using the same caches as Typesense indexing:

- `indexer/ols_cache/uberon_paths.json`
- `indexer/ols_cache/cl_paths.json`

## UI features

- Full-text filter over `title` / `search_blob` / `experiment_id`
- Facet checklists (list columns use `list_has_any` / `UNNEST`)
- Cards / Table (with group-by) / Pivot heatmap (click a cell to apply both axes as filters)
- Pagination in the browser

## Optional: Typesense InstantSearch path

```bash
docker compose up -d
python indexer/index_experiments.py --recreate
# then restore an InstantSearch UI or call Typesense directly
```

Optional FastAPI MCP stubs: `cd api && uvicorn main:app --reload --port 8000`.

## Layout

```
WP1/explore/
  indexer/
    export_parquet.py           # primary: JSON catalogs → Parquet
    index_experiments.py        # optional Typesense indexer
    ols_*.py / ols_cache/       # OLS hierarchy enrichment
  ui/
    public/experiments.parquet  # static artifact served by Vite
    src/duckdb.ts               # DuckDB-WASM loader + SQL helpers
    src/App.tsx
  api/                          # optional MCP stubs
  docker-compose.yml            # optional Typesense
```
