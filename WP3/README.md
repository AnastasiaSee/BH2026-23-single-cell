# WP3: Cell Type Homology Analysis via ElasticNet

This directory contains the analysis of species-specific transcriptomic divergence in homologous muscle cell populations (mouse vs. zebrafish), based on the SAMap integration results.

## Goal

To answer the core question: **Expression of which genes distinguishes what SAMap calls the "same" cell type?**

We use ElasticNet regression (L1/L2 penalty) to classify cells by species (Mouse = 0.0, Zebrafish = 1.0) within SAMap-defined homologous groups (fast_muscle, slow_muscle, progenitors). The model outputs:
1.  **Coefficients** for each gene (large value = strong discrimination).
2.  **\(R^2\) score** (interpreted as classification accuracy).

## Dataset

*   **Cells:** ~20,000 cells from mouse (`mm`) and zebrafish (`dr`), muscle populations.
*   **File:** `data/raw/samap_mm_dr_map2_20K`
*   **Ortholog Map:** `data/raw/GenePair_annot_map2.tsv`

## Methodology

1.  **Ortholog Mapping:** We force-renamed zebrafish genes to their mouse orthologs using the SAMap GenePair map to remove the "gene naming artifact" (`mm_` vs `dr_`). *Note: This map only covered 337 genes, so the mapping is partial.*
2.  **Grouping:** Cells were grouped into biological categories (`fast_muscle`, `slow_muscle`, `progenitors`) based on SAMap annotations.
3.  **Model:** `ElasticNet` (regression) with fixed hyperparameters (`alpha=0.01`, `l1_ratio=0.5`), following the methodology of Brito et al. (2025).
4.  **Subsampling:** Max 10,000 cells per species to ensure computational efficiency.

## Results (with partial ortholog mapping)

| Group | \(R^2\) | RMSE | Signature Size (# non-zero genes) | Top Discriminative Gene |
| :--- | :--- | :--- | :--- | :--- |
| **progenitors** | 0.8777 | 0.0842 | 213 | `mm_Meg3` (Mouse) |
| **fast_muscle** | 0.9948 | 0.0360 | 35 | `mm_Ttn` (Mouse) |
| **slow_muscle** | 0.9903 | 0.0477 | 61 | `dr_ttn.2` (Zebrafish) |

## Interpretation

*   **Progenitors (\(R^2\) = 0.88):** A more honest biological signal. The partial ortholog mapping reduced the naming artifact, and the model still distinguishes species well.
*   **Fast/Slow Muscle (\(R^2\) = 0.99):** The high \(R^2\) is partially inflated by gene naming artifacts. The top discriminative genes (e.g., Titin `Ttn`/`ttn.1`/`ttn.2`) were **not covered** by the partial 337-gene map, so the model still relies on `mm_` vs `dr_` prefixes.
*   **Signature Size (35–213 genes):** ElasticNet identified compact gene signatures. The number of genes increases for less differentiated cells (progenitors), which have more plastic transcriptomic programs.

## Comparison to SAMap

*   SAMap correctly identified homology at the cellular level.
*   ElasticNet reveals that the underlying gene regulatory programs are **highly divergent**, but the exact magnitude for fast/slow muscle is confounded by incomplete ortholog mapping.

## Caveats & Next Steps

1.  **Complete Ortholog Mapping:** The current ortholog map (337 genes) is partial. To get a truly unbiased biological signal, we need a complete map (e.g., from Ensembl BioMart or `SamapObject_mm_dr_annot_map2.pkl`).
2.  **Hyperparameter Tuning (Optuna):** Hyperparameters were fixed for the baseline. For a more robust model, we could use Optuna (Bayesian optimization) to tune `alpha` and `l1_ratio` via cross-validation. However, given that the main source of error is incomplete ortholog mapping, tuning will not change the biological conclusion.

## How to Run

```bash
cd WP3/src
python elasticnet_analysis.py
