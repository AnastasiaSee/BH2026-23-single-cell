# WP2 – Benchmarking gene homology maps for SAMap

**Project 23 · BioHackathon Europe 2026 · ELIXIR Single-Cell Omics**
*Single-cell dataset integration across repositories and species for cell-type homology analyses*

This work package corresponds to **Axis 2 (preprocessing benchmark)**. It asks how the choice of the
initial gene homology graph ("gene map") changes a SAMap cross-species integration, using
developmental skeletal myogenesis in **mouse** and **zebrafish** as the biological use case.

Everything else is kept fixed: same cells, same prepared count matrices, frozen mouse and zebrafish
annotations, same SAM preprocessing and SAMap settings. Only the gene map changes.

| Map | Method | Candidate relationships | Initial edge weights | Built by | Analysed in |
|---|---|---|---|---|---|
| **map1** | BLAST baseline (SAMap `map_genes.sh`) | Reciprocal translated cDNA hits | BLAST bit scores | SAMap `map_genes.sh` (commands in notebook 1) | `SAMap_v3.0_Dre_Hsa_Mmu_annot2.ipynb` |
| **map2** | MMseqs2 translated search | Reciprocal hits from an alternative translated search | MMseqs2 bit scores | `scripts/03_build_mmseqs_maps.py` | `SAMap_v3.0_Dre_Hsa_Mmu_annot2_map2.ipynb` |
| **map3** | BLAST + OrthoFinder family constraint | BLAST hits within a shared root HOG | Original BLAST bit scores | `scripts/04_build_orthofinder_maps.py` | *planned* |

**Evaluation criteria:** gene coverage and graph connectivity · expected cell-type matches and seed
stability · search time, integration time and peak RAM.

---

## Repository layout

The layout mirrors the working project directory used by the scripts and notebooks
(`ROOT` in the scripts, `PROJECT_DIR` in the notebooks). **`WP2/` is that directory**, so the relative
paths inside the code work unchanged once the root path is set.

```
WP2/
├── README.md                     ← this file
├── .gitignore
├── scripts/                      ← reference & gene-map generation (see scripts/README.md)
│   ├── 01_download_transcriptomes.sh
│   ├── 02_build_samap_fastas.py
│   ├── 03_build_mmseqs_maps.py
│   └── 04_build_orthofinder_maps.py
├── notebooks/                    ← data preparation, SAMap runs, figures (see notebooks/README.md)
│   ├── SAMap_v3.0_Dre_Hsa_Mmu_annot2.ipynb        (prep + map1 / BLAST)
│   └── SAMap_v3.0_Dre_Hsa_Mmu_annot2_map2.ipynb   (map2 / MMseqs2)
├── refs/
│   ├── raw/                      ← downloaded transcriptomes (not versioned, script 01)
│   ├── samap/                    ← one-sequence-per-gene FASTAs (not versioned, script 02)
│   ├── mappings/                 ← gene-name tables & selected transcripts (versioned, script 02)
│   └── orthofinder/              ← representative proteins, species tree, version (script 04)
├── maps/                         ← map1: BLAST maps from SAMap map_genes.sh
│   ├── hsmm/  hsdr/  mmdr/       ←   <a>_to_<b>.txt, one folder per species pair
├── maps_mmseqs/                  ← map2: MMseqs2 maps (script 03)
│   └── mmdr/
├── maps_orthofinder/             ← map3: family-constrained BLAST maps (script 04)
│   └── mmdr/
└── data/                         ← notebook outputs
    ├── processed_h5ad/           ← SAMap-ready H5AD files (not versioned, too large)
    └── samap/                    ← mapping-score tables (versioned) and SAMap objects (not versioned)
```

Each `maps*/` folder is passed to SAMap as `f_maps`; SAMap expects files named
`<sp1><sp2>/<sp1>_to_<sp2>.txt` (e.g. `mmdr/mm_to_dr.txt`) in plain tab-separated BLAST format.

---

## Data

| Species | Source | Used in final integration |
|---|---|---|
| Mouse (*Mus musculus*) | CZ CELLxGENE collection `45d5d2c3-bc28-4814-aed6-0bb6f0e11c82` (muscle cells) | yes |
| Zebrafish (*Danio rerio*) | CZ CELLxGENE collection `4ea9a90e-1dad-4c67-b1e3-8488ab7dc269` (Developmental Reference Atlas) | yes |
| Human (*Homo sapiens*) |https://cellxgene.cziscience.com/e/f7c1c579-2dc0-47e2-ba19-8165c5a0e353.cxg/ | prepared, **not integrated** |

The human dataset is fully prepared for SAMap and the human–mouse and human–zebrafish BLAST maps exist.

**Transcriptome / proteome references** (matched to the annotation used by each dataset):

| Species | cDNA (scripts 01–02) | Proteins (script 04) |
|---|---|---|
| Human | Ensembl 93, GRCh38 (as used by 10x `refdata-cellranger-GRCh38-3.0.0`) | Ensembl 93 |
| Mouse | GENCODE vM12, GRCm38 | GENCODE vM12 `pc_translations` |
| Zebrafish | Ensembl 116, GRCz11 | Ensembl 116 |

Raw H5AD files are not stored in this repository. Download them from the sources above and place them
in a folder of your choice (`RAW_DIR`, see *Configuring paths*).

---

## Requirements

* Conda environment with Python 3.12 and `sc-samap==3.0.1`, Scanpy ≥ 1.10 (with `igraph`/`leidenalg`),
  `anndata`, `pandas`, `numpy`, `scipy`, `holoviews` + `bokeh` (Sankey plots)
* BLAST+ and the SAMap repository (`map_genes.sh`) for map1
* MMseqs2 for map2: `conda install -c conda-forge -c bioconda mmseqs2`
* OrthoFinder (with DIAMOND and its MSA/tree dependencies) for map3
* `wget`, `gzip`

```bash
conda activate SAMapv3
python -m pip install "sc-samap==3.0.1"
```

---

## Configuring paths

All absolute paths have been replaced by placeholders. Edit them once before running:

| File | Variable | Set to |
|---|---|---|
| `scripts/01_download_transcriptomes.sh` | `ROOT` | absolute path of this `WP2/` folder |
| `scripts/02_build_samap_fastas.py` | `ROOT` | absolute path of this `WP2/` folder |
| `scripts/02_build_samap_fastas.py` | `HUMAN_H5AD`, `MOUSE_H5AD`, `ZEBRAFISH_H5AD` | the original (unmodified) H5AD files |
| `scripts/03_build_mmseqs_maps.py` | `ROOT` | absolute path of this `WP2/` folder |
| `scripts/04_build_orthofinder_maps.py` | `ROOT` | absolute path of this `WP2/` folder |
| both notebooks (configuration cell) | `PROJECT_DIR` | absolute path of this `WP2/` folder |
| both notebooks (configuration cell) | `RAW_DIR` | folder containing the original H5AD files |
| notebook 1, terminal snippet | `PROJECT_DIR` | absolute path of this `WP2/` folder |

`THREADS` (scripts 03, 04 and the `map_genes.sh` snippet) should be adapted to your machine.

---

## Running the workflow

Run from the `WP2/` folder in the activated environment.

```bash
# 1. Download the cDNA references                     -> refs/raw/
bash scripts/01_download_transcriptomes.sh

# 2. One representative transcript per gene, FASTA headers = SAMap gene names
#                                                      -> refs/samap/, refs/mappings/
python scripts/02_build_samap_fastas.py

# 3. map1 – BLAST baseline with SAMap's map_genes.sh   -> maps/
git clone https://github.com/atarashansky/SAMap.git SAMap_git
chmod +x SAMap_git/map_genes.sh
./SAMap_git/map_genes.sh \
  --tr1 refs/samap/mouse.GRCm38.GENCODEvM12.samap.fa --t1 nucl --n1 mm \
  --tr2 refs/samap/zebrafish.GRCz11.Ensembl116.samap.fa --t2 nucl --n2 dr \
  --threads 24
#    (human pairs hs-mm and hs-dr: see notebook 1)

# 4. map2 – MMseqs2                                    -> maps_mmseqs/mmdr/
python scripts/03_build_mmseqs_maps.py

# 5. map3 – OrthoFinder family constraint on map1      -> maps_orthofinder/mmdr/
python scripts/04_build_orthofinder_maps.py
```

Then open the notebooks in `notebooks/` (see `notebooks/README.md`). Notebook 1 must be run first: it
produces the SAMap-ready H5AD files used by every map.

> Scripts 03 and 04 **refuse to overwrite** an existing output folder. To rebuild a map, delete or
> rename `maps_mmseqs/mmdr/` or `maps_orthofinder/mmdr/`, or change `OUT` in the script.

---

## SAMap gene naming

Mouse and zebrafish CELLxGENE objects use Ensembl gene IDs as `var_names`. For readability, SAMap
features are converted to gene symbols, and symbols shared by several Ensembl genes are disambiguated:

* unique symbol → `GeneSymbol`
* ambiguous symbol → `GeneSymbol__EnsemblGeneID` (e.g. `rimbp2__ENSDARG…`)

The same names are used in the H5AD files, the FASTA headers and every gene map. The correspondence is
stored in `refs/mappings/<species>.gene_names.tsv`.

---

## Outputs

| Path | Content |
|---|---|
| `refs/mappings/*.gene_names.tsv` | Ensembl ID ↔ symbol ↔ SAMap name, ambiguity flag |
| `refs/mappings/*.selected_transcripts.tsv` | transcript selected per gene and its length |
| `refs/mappings/*.missing_from_transcriptome.tsv` | dataset genes without a transcript |
| `maps*/mmdr/{mm_to_dr,dr_to_mm}.txt` | gene maps (12-column BLAST tabular format) |
| `maps_mmseqs/mmdr/mmseqs_version.txt` | MMseqs2 version used |
| `maps_orthofinder/mmdr/filter_summary.json` | rows kept / removed per direction, family coverage |
| `data/samap/MappingD_*.csv`, `MappingT_*.csv` | SAMap cell-type mapping scores, per map |
| `data/samap/GenePair_*.tsv` | gene pairs supporting each cell-type alignment, per map |

Files larger than GitHub's 100 MB limit (H5AD, SAMap objects, large maps) are not versioned; they are
deposited separately (see *Data availability*).

---

## Data availability

*To be completed: Zenodo DOI for the SAMap-ready H5AD files, the annotated mouse dataset and any gene
map too large for GitHub.*

---

## References

* Tarashansky A.J. *et al.* Mapping single-cell atlases throughout Metazoa unravels cell type evolution. *eLife* 2021.
* Steinegger M. & Söding J. MMseqs2 enables sensitive protein sequence searching for the analysis of massive data sets. *Nat Biotechnol* 2017. doi:10.1038/nbt.3988
* Emms D.M. & Kelly S. OrthoFinder: phylogenetic orthology inference for comparative genomics. *Genome Biol* 2019. doi:10.1186/s13059-019-1832-y
* Cao J. *et al.* A human cell atlas of fetal gene expression. *Science* 2020.
## Contact

Sabrina Jagot – WP2, Project 23, BioHackathon Europe 2026
