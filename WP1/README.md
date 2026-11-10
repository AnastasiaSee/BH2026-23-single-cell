# WP1: Biodata resource integration

## Fenix experiment catalog

CELLxGENE / Fenix experiment metadata snapshot, download script, facet summary, and search-UI stack notes:

→ [`fenix/`](fenix/)

## Single Cell Portal study catalog

Broad Institute SCP search API snapshot (`source=single_cell_portal` in the explore index):

→ [`single_cell_portal/`](single_cell_portal/)

## Explore stack (Parquet + DuckDB-WASM)

Client-side faceted explore over Fenix + SCP (`source` facet): export JSON catalogs to Parquet, query in the browser with DuckDB-WASM.

→ [`explore/`](explore/)
