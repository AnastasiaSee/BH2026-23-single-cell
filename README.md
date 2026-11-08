# ELIXIR BioHackathon 2026 - Project 23 - Single-cell dataset integration across repositories and species for cell type homology analyses

Welcome! This repository is the shared workspace for [Project 23](https://github.com/elixir-europe/biohackathon-projects-2026/blob/main/23.md) of the ELIXIR BioHackathon 2026.

**Co-leads:** Frederic Bastian, Sabrina Jagot, Samantha Smith. **Support:** George Gavriilidis, Amnon Khen.

## Event and communication

- **Code of conduct:** we abide by the [ELIXIR code of conduct](https://elixir-europe.org/events/code-of-conduct).
- **Slack:** channel `23-single-cell-dataset-integration-across-repositories-and-species` on the BioHackEU Slack (registered participants only).
- **Zoom:** the event Zoom room has a dedicated breakout room for our project (online and in-person collaboration). The link must not be shared publicly: find it on the BioHackEU Slack or in your attendee information.
- **Key moments** (CET, subject to change): Mon 9 Nov 13:15 opening and project flash presentations, then hacking from 14:30; Wed 11 Nov 15:30-17:30 mid-week reporting poster session; Fri 13 Nov 11:00-12:30 final project presentations.

## Project description

Single-cell data keep growing, but reporting standards are not uniform across repositories. This makes datasets hard to find, integrate and reuse. At the same time, comparative single-cell atlases make it possible to study how cell types evolve across species. But cell type homology inference depends strongly on upstream choices: preprocessing, annotation granularity, and the gene homology relationships used to connect species.

**Our aims:**
1. Improve the mappability of single-cell datasets across resources and species.
2. Obtain an original biological result: how gene expression similarity depends on cell type homology and species distance.
3. Benchmark the tools used to do so.

**You might be interested in this project if you work on:**
- FAIR data and ontology reasoning
- tool benchmarking methods
- single-cell analyses, notably cross-species comparisons
- evolutionary biology

**Work packages**

| | Work package | Folder | What we do |
|---|---|---|---|
| **WP1** | Dataset mapping and discoverability | [WP1/](WP1/) | Extend scFAIR and CELLxGENE to discover and map relevant datasets (tissues, developmental stages and processes, several species) for WP2 and WP3. Ontologies, adaptors to biodata resources, query tools. |
| **WP2** | SAMap use and benchmarking | [WP2/](WP2/) | Benchmark how pre-processing choices affect results and mappability across species, to find workflows giving the most biologically meaningful results. Tool: [SAMap](https://doi.org/10.7554/eLife.66747). |
| **WP3** | Cell type homology across species | [WP3/](WP3/) | How similar is gene expression in homologous cell types depending on species distance, and how similar is it in non-homologous cell types with similar functions? Candidate methods include ElasticNet regression and outlier detection. |

Shared material that spans work packages goes in [all/](all/).

## Getting started

1. Clone this repository.
2. Set up your computing environment by following [WP1/SETUP.md](WP1/SETUP.md). It gives a conda environment with `anndata`, `scanpy`, the CELLxGENE Census and schema validator, and SAMap.

## Working together

- Fork https://github.com/fbastian/BH2026-23-single-cell/ and open pull requests with your code.
- Keep outputs of a work package in its folder, shared material in [all/](all/).
- Prefer scripts and notebooks that can be rerun; record tool versions and parameters.
- Do not commit large data files (H5AD, ...) or credentials. `.gitignore` already excludes common data formats; keep data outside the repository, use the communicated OneDrive folder instead.
- Commit small and often, and pull before you push.

## Useful resources (more details to add for WP2 and WP3)

- scFAIR portal: https://sc-fair.org (code: https://github.com/DeplanckeLab/scfair)
- scFAIR metadata schema (extension of CELLxGENE schema 7.1.0): https://github.com/scFAIR/scFAIR_schema
- scFAIR manuscript code, including a human vs mouse SAMap run: https://github.com/DeplanckeLab/scfair-manuscript
- CELLxGENE Discover Census: https://github.com/chanzuckerberg/cellxgene-census
