# Environment setup

Tested on macOS with conda. The tools below read, edit, query and validate H5AD files and run SAMap.

## 1. Create the environment

```bash
conda create -y -n bh23 python=3.12
conda activate bh23

# hnswlib (needed by SAMap) fails to build from pip on many machines, so take it from conda-forge
conda install -y -c conda-forge hnswlib

pip install anndata scanpy mudata cellxgene-census cellxgene-schema samap jupyterlab
```

Expected versions (as of 2026-11-08): `anndata` 0.11.4, `scanpy` 1.12.5, `mudata` 0.4.1, `cellxgene-census` 1.18.0, `cellxgene-schema` 7.1.2, `samap` 1.0.14, `tiledbsoma` 2.3.0.
`anndata` is held back from the latest release by the CELLxGENE packages; that is expected.

Notes:
- Use Python 3.12. The latest `scanpy`/`mudata` need >= 3.12, while `cellxgene-census` needs >= 3.10.
- Do not install into your base env.
- Windows: `tiledbsoma` (needed by `cellxgene-census`) may not install natively; use WSL2.
- If the pip install fails while building a wheel, you most likely need a C/C++ compiler (macOS: `xcode-select --install`; Linux: `build-essential`).

## 2. Check that it works

```bash
python - <<'EOF'
import anndata, scanpy, mudata, cellxgene_census, cellxgene_schema, samap, hnswlib
print("anndata", anndata.__version__, "| scanpy", scanpy.__version__, "| census", cellxgene_census.__version__)
EOF

cellxgene-schema --help
```

Quick Census query:

```python
import cellxgene_census
with cellxgene_census.open_soma() as census:
    obs = cellxgene_census.get_obs(
        census, "mus_musculus",
        value_filter="tissue_general == 'heart'",
        column_names=["dataset_id", "cell_type", "tissue", "development_stage"],
    )
print(obs.head())
```

## 3. Working with H5AD files

```python
import anndata as ad

adata = ad.read_h5ad("file.h5ad", backed="r")   # backed mode: does not load the expression matrix into memory
adata.obs.head()    # cell metadata (cell_type, tissue, development_stage, organism, ... + ontology term IDs)
adata.var.head()    # genes (Ensembl IDs)
adata.uns.keys()    # dataset-level metadata (incl. `analysis_pipeline` in scFAIR-compliant files)
```

- Command-line peek without Python: `h5ls -r file.h5ad`
- For discoverability work, read only `obs`, `var` and `uns`; do not load `X`.
- Never edit an original file. Write the modified data to a new file (`adata.write_h5ad("new.h5ad")`) and keep the original.
- Open files in backed mode `r` for reading. If you need to edit a backed object, copy it first (`adata.to_memory()`, or `adata.copy(filename="new.h5ad")`).

## 4. Schema validation

- CELLxGENE schema: `cellxgene-schema validate file.h5ad`
- scFAIR schema (fork of CZI schema 7.1.0): https://github.com/scFAIR/scFAIR_schema. Validation runs in ASAP (https://asap-test.epfl.ch/compliance/file-check); the rules are in https://github.com/DeplanckeLab/asap_web/blob/main/src/config/scfair/7.1.0/rules.yaml

## 5. Good to know

- **Census species:** CELLxGENE Census only covers human, mouse, macaque (`macaca_mulatta`), marmoset (`callithrix_jacchus`) and chimpanzee (`pan_troglodytes`). Other species must come from the CELLxGENE Discover API or other scFAIR resources (Bgee, ASAP, SCEA, ...).
- Pin the Census version in scripts for reproducibility: `cellxgene_census.open_soma(census_version="2025-11-08")`.
- Example SAMap run on human vs mouse brain: https://github.com/DeplanckeLab/scfair-manuscript (`samap/`).
- Do not commit data files or credentials to the repository. Keep downloaded data outside the repo or in a git-ignored folder.

