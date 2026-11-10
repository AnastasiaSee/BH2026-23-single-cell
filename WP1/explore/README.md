# Unified experiment explore stack (Fenix + Single Cell Portal)

**Client-side Parquet + DuckDB-WASM** — no search server, no API keys.

Catalogs:

- [`WP1/fenix/experiments.json`](../fenix/experiments.json) → `source=fenix`
- [`WP1/single_cell_portal/studies.json`](../single_cell_portal/studies.json) → `source=single_cell_portal`
- Optional partner JSON via `--json SOURCE=PATH` (see below)

| Piece | Role |
|-------|------|
| **Python exporter** | Flattens catalogs (+ OLS tissue/cell-type hierarchy) → `ui/public/experiments.parquet` |
| **React + Vite + DuckDB-WASM** | Search, facets, Cards/Table/Pivot in the browser |

## Prerequisites

- Python 3.11+ (Parquet export)
- Node.js 20+ (UI)
- Catalogs on disk (Fenix / SCP download scripts, or partner JSON)

## Quick start

```bash
cd WP1/explore

python3 -m venv .venv
source .venv/bin/activate
pip install -r indexer/requirements.txt
python indexer/export_parquet.py
# → ui/public/experiments.parquet (~1 MiB for ~1500 rows)

cd ui
npm install
npm run dev
# → http://127.0.0.1:5173
```

## Updating the Parquet file with more JSON

Whenever catalogs change (new rows, new source files, refreshed downloads):

1. **Put the JSON on disk** (Fenix snapshot, SCP snapshot, and/or a partner file).
2. **Re-export:**

```bash
cd WP1/explore
source .venv/bin/activate

# Defaults: Fenix + SCP
python indexer/export_parquet.py

# Add one or more partner catalogs (new-source ingest schema):
python indexer/export_parquet.py \
  --json example_partner=/path/to/partner-datasets.json

# Replace built-ins if needed:
python indexer/export_parquet.py \
  --skip-scp \
  --fenix-json ../fenix/experiments.json \
  --json my_org=../partner/datasets.json
```

3. **Reload the UI** (hard-refresh the browser so Vite re-fetches `/experiments.parquet`).

Partner JSON shape: a top-level `{ "datasets": [ … ] }` (or `{ "data": [ … ] }` / bare array). Each dataset should match the partner ingest schema (`id`, `title`, Term objects for `tissue` / `cell_type` / …). See the store doc `new-source-ingest-schema.md` / `new-source-example.json`.

Ids are namespaced as `{source}::{id}` so sources can share local ids without colliding. The faceted `source` field comes from the built-in name (`fenix`, `single_cell_portal`) or the `SOURCE` in `--json SOURCE=PATH`.

### OLS hierarchy refresh

```bash
python indexer/export_parquet.py --refresh-ols   # re-query OLS
# or warm caches first:
python indexer/enrich_tissue_hierarchy.py --scp
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
    catalog.py                  # flatten helpers (Fenix / SCP / partner)
    export_parquet.py           # JSON catalogs → Parquet
    ols_*.py / ols_cache/       # OLS hierarchy enrichment
  ui/
    public/experiments.parquet  # static artifact served by Vite
    src/duckdb.ts               # DuckDB-WASM loader + SQL helpers
    src/App.tsx
```
