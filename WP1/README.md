# WP1: Biodata resource integration

Pipeline to build the dataset metadata used for the species x factor table. All commands are run from this folder (`WP1/`), in the conda environment described in [SETUP.md](SETUP.md). Input and intermediate files live in `data/` (git-ignored); generated files to share, such as the term remapping TSV, go in `output/`.

## 1. Download the ontologies

From the `data` folder:

```
curl -sLO http://purl.obolibrary.org/obo/uberon/composite-metazoan.obo
curl -sLO http://purl.obolibrary.org/obo/uberon/collected-metazoan.obo
curl -sLO http://purl.obolibrary.org/obo/cl.obo
curl -sLO http://purl.obolibrary.org/obo/zfa.obo
```

`composite-metazoan.obo` is the reference ontology. The other three are only used to find the closest ancestors of terms that composite does not know (step 3).

## 2. Merge the datasets of the different sources

[scripts/merge_datasets.py](scripts/merge_datasets.py) merges the JSON exports of several sources into one deduplicated JSON.

```
python scripts/merge_datasets.py \
  --input cxg=data/datasets_CxG.json \
  --input scfair=data/datasets_scFAIR.json \
  --input fenix=data/datasets_fenix.json \
  --out data/datasets_merged.json \
  --report data/merged_datasets.tsv
```

- `--input FORMAT=PATH` is repeated once per source. `FORMAT` selects how the file is read: `cxg` (CELLxGENE curation API export), `scfair` (scFAIR portal export) or `fenix` (Single Cell Expression Atlas export). To add a source, write a reader function in the script and register it in `READERS`.
- **The order of the `--input` options is the priority**: the first source is preferred for scalar fields. Put the freshest source first.
- Deduplication:
  - the same dataset of the same source (same source and `source_reference_id`) is always merged;
  - datasets of different resources with the same DOI, the same organisms and the same cell count are merged too (only if unambiguous), and flagged with `"merged": true`. `--report` lists these merges.
- Merged records keep the most complete information: lists (tissue, cell type, ...) are the union of the sources. A record of an older version of a dataset (different `dataset_version_id`) only fills empty fields. scFAIR copies of CELLxGENE datasets have no version id: it is read from the name of their H5AD file (`<dataset_version_id>.h5ad`).
- Each output record has a `dataset_id` (`<source>:<source id>`) and a `sources` list with the provenance of every merged record.

## 3. Generate the term remapping file

[scripts/make_term_remappings.py](scripts/make_term_remappings.py) lists the annotations (tissue, cell type, developmental stage) of the merged datasets that must be remapped to terms of the composite-metazoan Uberon, and writes them to a TSV.

```
python scripts/make_term_remappings.py \
  --composite data/composite-metazoan.obo \
  --datasets data/datasets_merged.json \
  --out output/term_remappings.tsv \
  --extra-obo data/collected-metazoan.obo data/cl.obo data/zfa.obo \
  --manual term_remappings_manual.tsv
```

`--composite`, `--datasets` and `--out` are mandatory; the script downloads nothing. The remapping rules, in this order:

1. `unknown`, `na` or an empty annotation is remapped to the root of the ontology (tissue `UBERON:0001062`, cell type `CL:0000000`, developmental stage `UBERON:0000105`).
2. Cell lines (`CVCL_*`) are excluded.
3. A term that exists in composite is kept as is (no row). Stubs do not count: composite keeps an empty stanza (no name, no parents) for terms merged into another term, e.g. zebrafish `ZFA:0009248` merged into `CL:0000540` neuron; rule 5 remaps them.
4. An obsolete term with a replacement (`replaced_by`) is remapped to it (e.g. `CL:0000089` to `CL:0000016`).
5. A term that composite only knows as an xref of another term is remapped to that term (e.g. `HsapDv:0010000` to `UBERON:0000066`).
6. Any other term is remapped to its closest (most specific) ancestor present in composite and in the domain of the factor (see below), using the ontologies given with `--extra-obo`. Without `--extra-obo`, these terms get the action `unresolved`.

Manual remappings go in [term_remappings_manual.tsv](term_remappings_manual.tsv) (columns `factor`, `source_term_id`, `action` [`remap` or `exclude`], `target_term_id`, `comment`), given with `--manual`. They replace whatever the rules above produce for that term; a term mapped to several targets has one row per target. It currently holds the obsolete CL terms without replacement, the zebrafish segmentation and hatching stages, and `UBERON:0000104` (life cycle, used as a stage).

The output TSV has one row per remapping (columns: `factor`, `source_term_id`, `source_label`, `action`, `target_term_id`, `target_label`, `via_term_id`, `via_label`, `method`, `n_datasets`, `organisms`, `comment`). Rows with the action `unresolved` must be fixed in the manual file, not in the output TSV, which is overwritten each time the script runs.

When reading the ontologies, ancestors follow `is_a` and `part_of` (the FlyBase relation "substage of", `FBdv:00018001`, counts as `part_of`). Taxon-conditional relations (`{gci_relation="in_taxon", ...}`, e.g. embryo stage `is_a` "Brugia life stage") are ignored.

Because `part_of` crosses between kinds of entities, ancestors are restricted to the domain of each factor (this applies to rule 6 and to the ontology roll-up):

| Factor | Domain |
|---|---|
| cell type | `CL:0000000` (cell) and its descendants |
| tissue | `UBERON:0001062` (anatomical entity) and its descendants, except cell types (descendants of `CL:0000000`) |
| developmental stage | `UBERON:0000105` (life cycle stage) and its descendants |

Terms of BFO, NCBITaxon, COB and GO are never used. Without these restrictions, cell types would roll up into organs (e.g. "decidual natural killer cell, human" into decidua), and organs into taxa (Metazoa, through "multicellular organism"). A cell type annotated as tissue (e.g. a primary cell culture) stays a tissue column. It rolls up only through `part_of` into anatomy (e.g. tracheal epithelial cell to trachea), and it is remapped within the cell type domain if needed. The script warns about targets outside their domain, including xref and manual targets.
