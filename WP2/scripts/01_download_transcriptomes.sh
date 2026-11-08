#!/usr/bin/env bash

set -euo pipefail

ROOT="path/to/WP2"
RAW="$ROOT/refs/raw"

mkdir -p "$RAW"

download () {
    url="$1"
    output="$2"

    echo
    echo "=================================================="
    echo "Downloading: $output"
    echo "=================================================="

    if [ -s "$output" ]; then
        echo "File already exists: $output"
    else
        wget -c "$url" -O "$output"
    fi

    echo "Checking gzip integrity..."
    gzip -t "$output"

    echo "OK: $output"
}


# ============================================================
# HUMAN
#
# Human dataset:
# refdata-cellranger-GRCh38-3.0.0
#
# 10x built this reference from Ensembl release 93.
# ============================================================

download \
"https://ftp.ensembl.org/pub/release-93/fasta/homo_sapiens/cdna/Homo_sapiens.GRCh38.cdna.all.fa.gz" \
"$RAW/Homo_sapiens.GRCh38.Ensembl93.cdna.all.fa.gz"


# ============================================================
# MOUSE
#
# Publication:
# mm10 + GENCODE vM12
# GRCm38.p5
# ============================================================

download \
"https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_mouse/release_M12/gencode.vM12.transcripts.fa.gz" \
"$RAW/Mus_musculus.GRCm38.GENCODEvM12.transcripts.fa.gz"


# ============================================================
# ZEBRAFISH
#
# Latest numbered Ensembl release:
# Ensembl 116
# Assembly GRCz11
# ============================================================

download \
"https://ftp.ensembl.org/pub/release-116/fasta/danio_rerio/cdna/Danio_rerio.GRCz11.cdna.all.fa.gz" \
"$RAW/Danio_rerio.GRCz11.Ensembl116.cdna.all.fa.gz"


echo
echo "=================================================="
echo "ALL DOWNLOADS COMPLETE"
echo "=================================================="

