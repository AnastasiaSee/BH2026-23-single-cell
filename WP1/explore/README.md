# Experiment explore stack (Parquet + hyparquet)

**Client-side Parquet** — no search server, no API keys, no multi‑MB WASM engine.

Catalogs:

- [`WP1/fenix/experiments.json`](../fenix/experiments.json) → `source=fenix`
- Optional partner JSON via `--json SOURCE=PATH` (additional sources TBD)

| Piece | Role |
|-------|------|
| **Python exporter** | Flattens catalogs (+ OLS tissue/cell-type hierarchy) → `ui/public/experiments.parquet` |
| **React + Vite + hyparquet** | Loads Parquet in the browser (~0.5 MiB data + ~0.5 MiB JS); search/facets/pivot in memory |

> Why not DuckDB-WASM? Its `.wasm` is ~34 MiB and dominated cold start (~30s). For a few hundred catalog rows, hyparquet + JS filters is enough.

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

```bash
cd WP1/explore
source .venv/bin/activate

python indexer/export_parquet.py
python indexer/export_parquet.py \
  --json example_partner=/path/to/partner-datasets.json
```

Hard-refresh the UI so `/experiments.parquet` reloads.

Partner JSON: `{ "datasets": [ … ] }` (or `{ "data": [ … ] }` / bare array) matching the partner ingest schema.

### OLS hierarchy refresh

```bash
python indexer/export_parquet.py --refresh-ols
python indexer/enrich_tissue_hierarchy.py
python indexer/enrich_cell_type_hierarchy.py
python indexer/export_parquet.py
```

## Layout

```
WP1/explore/
  indexer/
    catalog.py / export_parquet.py
    ols_*.py / ols_cache/
  ui/
    public/experiments.parquet
    src/catalogQuery.ts          # hyparquet load + in-memory query
    src/App.tsx
```
