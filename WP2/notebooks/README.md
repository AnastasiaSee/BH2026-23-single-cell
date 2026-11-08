# Notebooks – data preparation and SAMap integrations

Kernel: conda environment `SAMapv3` (Python 3.12, `sc-samap==3.0.1`).
Before running, set `PROJECT_DIR` (absolute path of `WP2/`) and `RAW_DIR` (folder with the original
H5AD files) in the configuration cell at the top of each notebook.

## Quick start for the benchmark (recommended)

You do **not** need to rerun the whole preparation to benchmark gene maps.

**1. Skip scripts 01 and 02.** Their outputs are already provided:

| Output | Location |
|---|---|
| SAMap FASTAs (`*.samap.fa`) | `refs/samap/` – *link to be added* |
| Gene-name and selected-transcript tables | `refs/mappings/` (in this repository) |
| map1 BLAST maps | `maps/` (in this repository) |

These are the inputs of `scripts/03_build_mmseqs_maps.py` and `scripts/04_build_orthofinder_maps.py`,
so you can build or modify a gene map directly.

**2. Start from the SAMap-ready H5AD files.** Download them (*link to be added*) into
`data/processed_h5ad/`:

| File | Content |
|---|---|
| `mouse_annot_SKM_samap_ready.h5ad` | mouse, raw counts in `.X`, **re-annotated** (`cell_type` = manual labels, original labels in `cell_type_origin`) |
| `zebrafish_SKM_samap_ready.h5ad` | zebrafish myogenic compartment, unperturbed cells, raw counts in `.X` |


The mouse annotations are frozen in this file: use it rather than re-clustering, so that every gene map
is compared on exactly the same labels.

**3. Run a SAMap integration.** Open `SAMap_v3.0_Dre_Hsa_Mmu_annot2_map2.ipynb` (it only reads the two
ready H5AD files), set `PROJECT_DIR` and point `MAPS_DIR` to the gene map you want to test
(`maps`, `maps_mmseqs`, `maps_orthofinder` or your own folder). Change the output suffix (`_map2`) so
results from different maps do not overwrite each other.

Notebook 1 is only needed to reproduce the data preparation and the mouse re-annotation from the
original CELLxGENE files.

## Full reproduction

Run **notebook 1 first**: it creates the SAMap-ready H5AD files used by every gene map.

## 1. `SAMap_v3.0_Dre_Hsa_Mmu_annot2.ipynb` – preparation + map1 (BLAST)

1. **Dataset selection and FAIR considerations** – why the final integration is mouse–zebrafish only.
2. **Gene identifier harmonization** – symbols as SAMap names, `Symbol__EnsemblGeneID` for ambiguous symbols.
3. **Construction of gene maps** – terminal commands (not executed by *Run All*) for scripts 01–02 and
   SAMap `map_genes.sh` for hs↔mm, hs↔dr and mm↔dr.
4. **Zebrafish myogenic compartment** – unperturbed cells (`perturbation_strategy == "na"`) from slow
   and fast muscle, somite, presomitic mesoderm, myotome, craniocervical muscle and hypaxial
   musculature (~102,000 cells).
5. **Raw count matrices** – diagnostics of `.X`, `.raw.X` and layers; mouse raw counts moved to `.X`,
   normalized values kept in `layers["X_normalized_original"]`.
6. **Mouse reanalysis and manual annotation** – normalization, HVG, PCA, Leiden (resolutions 0.3–1.0),
   UMAP, markers, myogenesis gene-set scores, manual labels on `leiden_re_0.4`.
   `REBUILD_MOUSE_ANNOTATION = True` recomputes everything; `False` reloads the saved annotated H5AD.
7. **Mouse–zebrafish SAMap integration** with `f_maps = PROJECT_DIR/maps/` – mapping scores, Sankey plot,
   `GenePairFinder` gene pairs, joint UMAP.

Outputs: `data/processed_h5ad/*_samap_ready.h5ad`, `data/processed_h5ad/mouse_annot_SKM_samap_ready.h5ad`,
`data/samap/MappingD_mm_dr_annot.csv`, `MappingT_mm_dr_annot.csv`, `GenePair_annot.tsv`,
`Marker_annot_df.csv`, `samap_mm_dr_annot.h5ad`, `SamapObject_mm_dr_annot.pkl`.

## 2. `SAMap_v3.0_Dre_Hsa_Mmu_annot2_map2.ipynb` – map2 (MMseqs2)

Builds the MMseqs2 map (`scripts/03_build_mmseqs_maps.py`), then reruns the same SAMap integration on
the same H5AD files with `f_maps = PROJECT_DIR/maps_mmseqs/`. All outputs carry the suffix `_map2`.

## 3. map3 (BLAST + OrthoFinder) – planned

Copy notebook 2, set `MAPS_DIR = PROJECT_DIR / "maps_orthofinder"`, call
`scripts/04_build_orthofinder_maps.py` instead of script 03 and use the suffix `_map3` for outputs.

