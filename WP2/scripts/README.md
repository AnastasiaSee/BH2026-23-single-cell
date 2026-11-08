# Scripts – reference preparation and gene-map generation

Run every script from the `WP2/` folder after setting `ROOT` (and, for script 02, the H5AD paths).
Numbering gives the execution order. The BLAST baseline (map1) is produced between scripts 02 and 03
by SAMap's own `map_genes.sh` (see the main README).

| Script | Purpose | Inputs | Outputs |
|---|---|---|---|
| `01_download_transcriptomes.sh` | Download cDNA references matching each dataset's annotation and check gzip integrity | – (internet) | `refs/raw/*.fa.gz` |
| `02_build_samap_fastas.py` | Build one sequence per gene (longest cDNA transcript), with FASTA IDs equal to SAMap gene names | original H5AD files, `refs/raw/*.fa.gz` | `refs/samap/*.samap.fa`, `refs/mappings/*.tsv` |
| `03_build_mmseqs_maps.py` | **map2** – bidirectional MMseqs2 translated search on the same cDNAs | `refs/samap/{mouse,zebrafish}*.samap.fa` | `maps_mmseqs/mmdr/` |
| `04_build_orthofinder_maps.py` | **map3** – keep BLAST pairs only when both genes share an OrthoFinder root HOG | `maps/mmdr/` (map1), `refs/mappings/{mm,zf}.gene_names.tsv`, proteomes (downloaded) | `maps_orthofinder/mmdr/`, `refs/orthofinder/` |

## 01_download_transcriptomes.sh

* Human: Ensembl 93 GRCh38 cDNA · Mouse: GENCODE vM12 transcripts · Zebrafish: Ensembl 116 GRCz11 cDNA
* Skips files that already exist; always re-checks gzip integrity.

## 02_build_samap_fastas.py

* Reads only `.var` of each H5AD (backed mode).
* Gene IDs: human `var["gene_ids"]`; mouse and zebrafish `var_names` (Ensembl), symbols from `var["gene_short_name"]`.
* Ambiguous symbols become `Symbol__EnsemblGeneID`; the script stops if names are not unique or contain whitespace.
* Representative transcript: longest cDNA; ties broken by transcript ID (deterministic).
* FASTA header: `>samap_gene gene_id=… transcript_id=… length=…` (first token = SAMap name).
* Writes, per species (`hu`, `mm`, `zf`): `gene_names.tsv`, `selected_transcripts.tsv`,
  `missing_from_transcriptome.tsv`; prints coverage.

## 03_build_mmseqs_maps.py

* `mmseqs search --search-type 2` (translated nucleotide vs nucleotide), both directions mm→dr and dr→mm.
* Parameters: E-value ≤ 1e-6, sensitivity `-s 7.5`, minimum ORF length 30 aa, `--max-seqs 10000`,
  translation table 1.
* Full FASTA headers are exported and their first token kept, so that names such as `ucp3` are not
  truncated by MMseqs2 accession parsing.
* Collapses ORF/frame hits to the best alignment per directed gene pair (highest bit score, then lowest
  E-value); several targets per query are kept – SAMap handles reciprocity.
* Working files go to `ROOT/tmp/` and are kept on failure.
* Refuses to run if `maps_mmseqs/mmdr/` already exists.

## 04_build_orthofinder_maps.py

* Downloads human (Ensembl 93), mouse (GENCODE M12) and zebrafish (Ensembl 116) proteomes; keeps the
  longest protein per gene.
* Runs OrthoFinder with `-M msa -S diamond_ultra_sens` and the species tree `((mm,hs),dr);`.
  Human is a reference species for family inference only.
* Uses the root HOG partition (`N0.tsv`, or `Orthogroups.tsv` for OrthoFinder ≥ 3.1).
* Filters the existing BLAST map (`maps/mmdr/`); BLAST identifiers, scores and E-values are unchanged.
  Genes without a family assignment are dropped and counted in `filter_summary.json`.
* Reuses an existing completed OrthoFinder run in `refs/orthofinder/results/`.
* Refuses to run if `maps_orthofinder/mmdr/` already exists.

## Parameters to adapt

| Script | Variable | Default |
|---|---|---|
| 03 | `THREADS`, `EVALUE`, `SENSITIVITY`, `MAX_SEQS` | 24, 1e-6, 7.5, 10000 |
| 04 | `THREADS`, `ANALYSIS_THREADS` | 24, 4 |

