#!/usr/bin/env python3
"""Add an OrthoFinder FAMILY CONSTRAINT to your existing mouse/zebrafish maps.

1. Download protein references matching your existing reference releases.
2. Infer families from full proteomes (one longest protein per gene).
3. Keep existing BLAST records only when both genes share a root HOG.

Human is a reference species for family inference, not an expression input.
Existing samap_gene names, selected cDNA transcripts and BLAST scores are kept.
This is a family-constrained BLAST map, not a strict ortholog-only map. Genes
without a protein/family assignment are excluded and counted in the summary.

Install OrthoFinder and its dependencies, then run:
    python scripts/04_build_orthofinder_maps.py

Docs: https://orthofinder.github.io/OrthoFinder/tutorials/guide-to-results/
"""

from pathlib import Path
import csv
import gzip
import json
import re
import shutil
import subprocess
import tempfile
import urllib.request


# Same ROOT as your notebook and 02_build_samap_fastas.py.
ROOT = Path("path/to/WP2")
WORK = ROOT / "refs" / "orthofinder"
PROTEOMES = WORK / "proteomes"
RESULTS = WORK / "results"
BLAST_MAPS = ROOT / "maps" / "mmdr"
OUT = ROOT / "maps_orthofinder" / "mmdr"
THREADS = 24
ANALYSIS_THREADS = 4

# Your script 02 uses 'zf' for the zebrafish naming table; SAMap uses 'dr'.
GENE_TABLES = {
    "mm": ROOT / "refs/mappings/mm.gene_names.tsv",
    "dr": ROOT / "refs/mappings/zf.gene_names.tsv",
}

# Full reference proteomes, matched to your original annotation releases.
PROTEIN_URLS = {
    "mm": "https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_mouse/release_M12/gencode.vM12.pc_translations.fa.gz",
    "dr": "https://ftp.ensembl.org/pub/release-116/fasta/danio_rerio/pep/Danio_rerio.GRCz11.pep.all.fa.gz",
    "hs": "https://ftp.ensembl.org/pub/release-93/fasta/homo_sapiens/pep/Homo_sapiens.GRCh38.pep.all.fa.gz",
}
GENE_PATTERNS = {
    "mm": r"\b(ENSMUSG\d+)(?:\.\d+)?\b",
    "dr": r"\bgene:(ENSDARG\d+)(?:\.\d+)?\b",
    "hs": r"\bgene:(ENSG\d+)(?:\.\d+)?\b",
}


def read_gene_names(path):
    """Use the existing table; do not reconstruct or modify SAMap names."""
    names = {}
    with path.open() as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        if not {"samap_gene", "ensembl_gene_id"}.issubset(reader.fieldnames or []):
            raise ValueError(f"Missing gene-name columns in {path}")
        for row in reader:
            name = row["samap_gene"]
            gene = re.sub(r"\.\d+$", "", row["ensembl_gene_id"])
            if not name or not gene or name in names:
                raise ValueError(f"Missing or repeated SAMap gene name in {path}: {name!r}")
            names[name] = gene
    if not names:
        raise ValueError(f"Empty gene-name table: {path}")
    return names


def fasta_records(path):
    header, sequence = None, []
    with gzip.open(path, "rt") as handle:
        for line in handle:
            if line.startswith(">"):
                if header is not None:
                    yield header, "".join(sequence)
                header, sequence = line[1:].strip(), []
            else:
                sequence.append(line.strip())
        if header is not None:
            yield header, "".join(sequence)


def prepare_proteome(sid, url):
    archive = WORK / "raw" / url.rsplit("/", 1)[1]
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        print(f"Downloading {sid} proteins", flush=True)
        partial = archive.with_name(archive.name + ".part")
        with urllib.request.urlopen(url, timeout=60) as source, partial.open("wb") as target:
            shutil.copyfileobj(source, target)
        partial.replace(archive)

    best = {}
    for header, sequence in fasta_records(archive):
        match = re.search(GENE_PATTERNS[sid], header)
        if match is None:
            raise ValueError(f"Cannot extract {sid} gene ID from header: {header}")
        gene, protein = match.group(1), header.split()[0]
        sequence = sequence.upper().rstrip("*")
        if not sequence:
            continue
        previous = best.get(gene)
        if (previous is None or len(sequence) > len(previous[1]) or
                (len(sequence) == len(previous[1]) and protein < previous[0])):
            best[gene] = (protein, sequence)
    if not best:
        raise ValueError(f"No proteins read from {archive}")
    PROTEOMES.mkdir(parents=True, exist_ok=True)
    with (PROTEOMES / f"{sid}.fa").open("w") as handle:
        for gene, (_, sequence) in sorted(best.items()):
            # Stable IDs avoid OrthoFinder sanitizing symbols such as 'zgc:...'.
            handle.write(f">{gene}\n{sequence}\n")
    with (WORK / f"{sid}.representative_proteins.tsv").open("w", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["ensembl_gene_id", "protein_id", "length"])
        writer.writerows((gene, protein, len(seq)) for gene, (protein, seq) in sorted(best.items()))
    print(f"{sid}: {len(best):,} genes in the full reference proteome", flush=True)


def find_root_groups():
    # OrthoFinder 2.4-3.0: N0.tsv. OrthoFinder >=3.1: Orthogroups.tsv.
    for pattern in ("Phylogenetic_Hierarchical_Orthogroups/N0.tsv",
                    "Orthogroups/Orthogroups.tsv"):
        candidates = list(RESULTS.glob("**/" + pattern))
        if len(candidates) > 1:
            raise ValueError(f"Several root partitions found under {RESULTS}")
        if candidates:
            candidate = candidates[0]
            if candidate.name == "Orthogroups.tsv":
                version_file = WORK / "orthofinder_version.txt"
                version = re.search(r"(?i)orthofinder(?:\s+version)?\s+v?(\d+)\.(\d+)",
                                    version_file.read_text() if version_file.exists() else "")
                if version is None or tuple(map(int, version.groups())) < (3, 1):
                    raise RuntimeError("Need final N0.tsv for OrthoFinder <3.1; cannot use its MCL Orthogroups.tsv")
            # Do not accept an MCL-only or incomplete run as phylogenetic HOGs.
            if not (candidate.parent.parent / "Species_Tree/SpeciesTree_rooted_node_labels.txt").exists():
                raise RuntimeError("OrthoFinder phylogenetic analysis is incomplete")
            return candidate
    return None


def read_families(path):
    families = {"mm": {}, "dr": {}}
    with path.open() as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        header = reader.fieldnames or []
        key = next((name for name in ("HOG", "Orthogroup") if name in header), None)
        if key is None or not {"mm", "dr"}.issubset(header):
            raise ValueError(f"Expected mm/dr species columns and a HOG/Orthogroup column: {header}")
        for row in reader:
            for sid, members in families.items():
                for gene in filter(None, (item.strip() for item in row[sid].split(","))):
                    if gene in members:
                        raise ValueError(f"Gene repeated across family rows: {gene}")
                    members[gene] = row[key]
    if not all(families.values()):
        raise ValueError("No family memberships for one of the two target species")
    return families


def filter_blast(source, target, query_names, target_names, query_groups, target_groups):
    counts = {"input_rows": 0, "kept_rows": 0, "unassigned_rows": 0, "different_family_rows": 0}
    with source.open() as inp, target.open("w", newline="") as out:
        writer = csv.writer(out, delimiter="\t", lineterminator="\n")
        for row in csv.reader(inp, delimiter="\t"):
            if len(row) != 12:
                raise ValueError(f"Expected 12 BLAST columns in {source}")
            query, hit = row[:2]
            if query not in query_names or hit not in target_names:
                raise ValueError(f"BLAST names do not match your selected gene tables: {query}, {hit}")
            first = query_groups.get(query_names[query])
            second = target_groups.get(target_names[hit])
            counts["input_rows"] += 1
            if first is None or second is None:
                counts["unassigned_rows"] += 1
            elif first != second:
                counts["different_family_rows"] += 1
            else:
                writer.writerow(row)  # Original identifiers, scores and E-values.
                counts["kept_rows"] += 1
    if not counts["kept_rows"]:
        raise ValueError("No retained BLAST rows; check the family partition and gene IDs")
    return counts


def main():
    if OUT.exists():
        raise FileExistsError(f"{OUT} already exists; choose another OUT for a new map")
    names = {sid: read_gene_names(path) for sid, path in GENE_TABLES.items()}
    for filename in ("mm_to_dr.txt", "dr_to_mm.txt"):
        if not (BLAST_MAPS / filename).is_file():
            raise FileNotFoundError(BLAST_MAPS / filename)
    WORK.mkdir(parents=True, exist_ok=True)
    groups = find_root_groups()
    if groups is None:
        if RESULTS.exists():
            raise RuntimeError(f"Incomplete results in {RESULTS}; resume OrthoFinder or choose a new RESULTS path")
        if shutil.which("orthofinder") is None:
            raise RuntimeError("Install OrthoFinder with its dependencies before running this script")
        for sid, url in PROTEIN_URLS.items():
            prepare_proteome(sid, url)
        tree = WORK / "species_tree.nwk"
        tree.write_text("((mm,hs),dr);\n")
        with (WORK / "orthofinder_version.txt").open("w") as handle:
            subprocess.run(["orthofinder", "-v"], check=True, stdout=handle, stderr=subprocess.STDOUT)
        subprocess.run(["orthofinder", "-f", str(PROTEOMES), "-o", str(RESULTS),
                        "-M", "msa", "-S", "diamond_ultra_sens", "-s", str(tree),
                        "-t", str(THREADS), "-a", str(ANALYSIS_THREADS)], check=True)
        groups = find_root_groups()
        if groups is None:
            raise RuntimeError("No completed root HOG partition found after OrthoFinder")
    print(f"Using root family partition: {groups}", flush=True)
    families = read_families(groups)
    summary = {"family_partition": str(groups), "protein_references": PROTEIN_URLS,
               "selected_genes_with_family": {}, "directions": {}}
    for sid in names:
        matched = sum(gene in families[sid] for gene in names[sid].values())
        summary["selected_genes_with_family"][sid] = {"assigned": matched, "total": len(names[sid])}
        if not matched:
            raise ValueError(f"No {sid} gene IDs match the OrthoFinder partition")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="orthofinder_maps_", dir=OUT.parent) as directory:
        stage = Path(directory)
        for query, target in (("mm", "dr"), ("dr", "mm")):
            filename = f"{query}_to_{target}.txt"
            stats = filter_blast(BLAST_MAPS / filename, stage / filename,
                                 names[query], names[target], families[query], families[target])
            summary["directions"][filename] = stats
            print(f"{filename}: {stats['kept_rows']:,}/{stats['input_rows']:,} rows kept", flush=True)
        (stage / "filter_summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        OUT.mkdir()
        for path in stage.iterdir():
            shutil.copyfile(path, OUT / path.name)
    print(f"Finished. SAMap f_maps: {OUT.parent}/")


if __name__ == "__main__":
    main()
