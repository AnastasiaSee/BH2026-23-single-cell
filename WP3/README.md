# Cell-type homology
Project 23 - BioHackathon Europe 2026 - ELIXER Single-Cell Omics - _Single-cell dataset integration across repositories and species for cell-type homology analyses_

This repository contains the scripts and output from Axis 3 (homology and non-homology signals). We focus on developing a pipeline to robustly detect homologous and species-specific cell types across species and the genes that underlie these patterns. We use the SAMap output from WP2 (benchmarking) and apply two different kinds of analyses.

| **Category**     | **Approach**          | **Input**              | **Output**                    |
|:----------------:|:---------------------:|:----------------------:|:-----------------------------:|
| Expression-first | ElasticNet Regression | Expression matrix      | species-specific genes        |
| Manifold-first   | Local outlier factor  | joint species manifold | species-specific cells/states |

Our strategy was to choose two types of methods that use different data inputs and algorithms to infer species-specific cell-types and expression profiles. We compare the results of these methods with SAMap output (homology alignment scores and gene pairs). 

# ElasticNet regression
The first method is ElasticNet regression which takes an expression matrix and weighs the ability of each gene to classify a cell in a category of interest (e.g., species). We provide expression matrices for SAMap-defined homologous groups and it outputs coefficients for each gene as well as a classification accuracy value. Gene weights allow us to detect genes that drive species-specific signals while we can compare the classification accuracy score to determine the overall strength of the species-specific signal.

Interpretation
|                                   | High SAMap homology                    | Low SAMap homology          |
| High species classification score | homology + transcriptional divergence? | Candidate non-homology      |
| Low species classification score  | homology + strong conservation?        | Ambiguous / poorly resolved |

# Local outlier factor
The other method we test is a novelty detection method (local outlier factor) which takes a manifold and asks how much a datapoint (e.g., a cell) differs from its closest neighbor. We provide PCA (integrated dataset) from SAMap and it outputs outlier scores which we will aggregate by cell-type annotation and integrate with other sources of information like marker gene expression and lack of SAMap-based homology support. We then characterize candidate species-specific clusters.

# Repository layout

|__ config
|     |__ WP3_minimal_env.yml       
|__ notebooks
|     |__ WP3_notebook_1.ipynb
|__ scripts
|__ README.md

# Running the workflow

To be updated after scripts finished.

# References
* Tarashansky et al. (2021)
