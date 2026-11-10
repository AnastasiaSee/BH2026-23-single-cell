# Experiment explore stack (Parquet + DuckDB-WASM)

**Client-side Parquet + DuckDB-WASM** — no search server, no API keys.

Catalogs:

- [`WP1/fenix/experiments.json`](../fenix/experiments.json) → `source=fenix`
- Optional partner JSON via `--json SOURCE=PATH` (additional sources TBD)

| Piece | Role |
|-------|------|
| **Python exporter** | Flattens catalogs (+ OLS tissue/cell-type hierarchy) → `ui/public/experiments.parquet` |
| **React + Vite + DuckDB-WASM** | Search, facets, Cards/Table/Pivot in the browser |

## Prerequisites

- Python 3.11+ (Parquet export)
- Node.js 20+ (UI)
- Fenix catalog (or partner JSON): `python3 WP1/fenix/download_experiments.py`

## Quick start

```bash
cd WP1/explore

python3 -m venv .venv
source .venv/bin/activate
pip install -r indexer/requirements.txt
python indexer/export_parquet.py
# → ui/public/experiments.parquet

cd ui
npm install
npm run dev
# → http://127.0.0.1:5173
```

## Updating the Parquet file with more JSON

Whenever catalogs change (new rows, new source files, refreshed downloads):

1. **Put the JSON on disk** (Fenix snapshot and/or a partner file).
2. **Re-export:**

```bash
cd WP1/explore
source .venv/bin/activate

# Fenix only (default)
python indexer/export_parquet.py

# Add one or more partner catalogs (new-source ingest schema):
python indexer/export_parquet.py \
  --json example_partner=/path/to/partner-datasets.json
```

3. **Reload the UI** (hard-refresh so Vite re-fetches `/experiments.parquet`).

Partner JSON shape: `{ "datasets": [ … ] }` (or `{ "data": [ … ] }` / bare array). Each dataset should match the partner ingest schema (`id`, `title`, Term objects for `tissue` / `cell_type` / …).

Ids are namespaced as `{source}::{id}`. The faceted `source` field is `fenix` or the `SOURCE` from `--json SOURCE=PATH`.

### OLS hierarchy refresh

```bash
python indexer/export_parquet.py --refresh-ols
# or warm caches first:
python indexer/enrich_tissue_hierarchy.py
python indexer/enrich_cell_type_hierarchy.py
python indexer/export_parquet.py
```

Caches live under `indexer/ols_cache/`.

## UI features

- Full-text filter over `title` / `search_blob` / `experiment_id`
- Facet checklists (list columns via DuckDB `list_has_any` / `UNNEST`)
- Cards / Table (group-by) / Pivot heatmap
- Client-side pagination

## Layout

```
WP1/explore/
  indexer/
    catalog.py                  # flatten helpers (Fenix / partner)
    export_parquet.py           # JSON catalogs → Parquet
    ols_*.py / ols_cache/       # OLS hierarchy enrichment
  ui/
    public/experiments.parquet  # static artifact served by Vite
    src/duckdb.ts               # DuckDB-WASM loader + SQL helpers
    src/App.tsx
```
