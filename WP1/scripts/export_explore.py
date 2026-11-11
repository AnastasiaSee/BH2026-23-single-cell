"""Export the merged datasets, with remapped terms and the term hierarchy, for the explore UI.

Reads the merged datasets JSON (merge_datasets.py), the term remapping TSV
(make_term_remappings.py), the term ancestor TSV (make_term_ancestors.py) and the term subset
TSV (make_term_subsets.py), and writes two Parquet files loaded by the browser
(WP1/explore/ui):

--out-datasets: one row per dataset. Columns holding facet values are lists of value ids:
  organism           NCBITaxon ids; subspecies are folded into their species (a label of 3 or
                     more words becomes its first two words, with the id of that species in
                     the datasets, e.g. Mus musculus musculus -> Mus musculus)
  tissue, cell_type, development_stage
                     terms after remapping (remap -> targets, exclude -> dropped); an empty
                     annotation is 'na', remapped to the root of the factor by the TSV
  assay, disease, sex
                     ontology term ids ('label:<label>' for entries without id); 'unknown',
                     'na' and empty annotations are all 'na'
  suspension_type    cell, nucleus or na ('na' and empty are both 'na')
  tissue_type        tissue types of the tissue entries (CELLxGENE only), else 'na'
  source             resources of the dataset (several for datasets merged across resources)
  flags              'merged' (merged across resources), 'multi_species' (several species)
  plus: id, title (falls back to collection name, then DOI label or resource name with the
  resource id), cell_count, explorer_url, h5ad_url, doi, doi_label, collection_name,
  source_explorer_urls (explorer URL per entry of `source`), search_blob (text search).

--out-terms: one row per value of each field: field, id, label, parent_ids, ancestor_ids,
  subsets. For tissue, cell type and developmental stage, these come from the ancestor TSV
  (annotated terms and their ancestors within the factor domain); the UI computes the roll-up
  from them. subsets: the subsets of the term in the subset TSV (e.g. upper_level); the UI
  hides these terms in the filter trees and the roll-up columns. Other fields have no
  hierarchy and no subsets.

The input files are not modified.

Usage: python WP1/scripts/export_explore.py --datasets datasets_merged.json
           --remappings term_remappings.tsv --ancestors term_ancestors.tsv
           --subsets term_subsets.tsv --out-datasets datasets.parquet --out-terms terms.parquet
"""

import argparse
import collections
import csv
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from make_term_ancestors import read_remappings, remapped_terms
from make_term_remappings import FACTORS

NA = "na"
NA_LABEL = "NA (not annotated)"
UNKNOWN_IDS = {"unknown", "na"}
TERM_FIELDS = ("assay", "disease", "sex")
FLAG_LABELS = {"merged": "merged across resources", "multi_species": "several species"}
LIST_COLUMNS = ("organism", *FACTORS, *TERM_FIELDS, "suspension_type", "tissue_type",
                "source", "flags", "source_explorer_urls")


def read_ancestors(path):
    """{factor: {term_id: (label, [parent ids], [ancestor ids])}} from make_term_ancestors.py."""
    terms = collections.defaultdict(dict)
    with path.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f, delimiter="\t"):
            split = lambda s: s.split(";") if s else []
            terms[r["factor"]][r["term_id"]] = (r["term_label"], split(r["parent_ids"]),
                                                split(r["ancestor_ids"]))
    return terms


def species_map(datasets):
    """{organism id: (species id, species label)}: subspecies folded into their species."""
    by_label = {}
    for d in datasets:
        for o in d["organism"]:
            by_label.setdefault(o["label"], o["ontology_term_id"])
    fold, missing = {}, []
    for label, oid in by_label.items():
        words = label.split()
        species = " ".join(words[:2])
        if len(words) > 2 and species in by_label:
            fold[oid] = (by_label[species], species)
        else:
            if len(words) > 2:
                missing.append(label)
            fold[oid] = (oid, label)
    if missing:
        print("warning: subspecies kept, their species is in no dataset: " + ", ".join(missing))
    return fold


def term_values(dataset, field):
    """[(id, label)] of an ontology-term field; unknown/na/empty -> 'na'."""
    out = {}
    for o in dataset.get(field) or []:
        tid = o.get("ontology_term_id") or f"label:{o.get('label')}"
        if tid in UNKNOWN_IDS:
            tid = NA
        out.setdefault(tid, NA_LABEL if tid == NA else o.get("label") or tid)
    return list(out.items()) or [(NA, NA_LABEL)]


def title_of(d):
    if d.get("title"):
        return d["title"]
    if d.get("collection_name"):
        return d["collection_name"]
    ref = d["source_reference_id"]
    return f"{d['collection_doi_label']} ({ref})" if d.get("collection_doi_label") \
        else f"{d['source']['name']} {ref}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--datasets", type=Path, required=True,
                    help="merged datasets JSON written by merge_datasets.py")
    ap.add_argument("--remappings", type=Path, required=True,
                    help="term remapping TSV written by make_term_remappings.py")
    ap.add_argument("--ancestors", type=Path, required=True,
                    help="term ancestor TSV written by make_term_ancestors.py")
    ap.add_argument("--subsets", type=Path, required=True,
                    help="term subset TSV written by make_term_subsets.py")
    ap.add_argument("--out-datasets", type=Path, required=True, help="dataset Parquet to write")
    ap.add_argument("--out-terms", type=Path, required=True, help="term Parquet to write")
    args = ap.parse_args()

    datasets = json.load(args.datasets.open(encoding="utf-8"))
    remap = read_remappings(args.remappings)
    hierarchy = read_ancestors(args.ancestors)
    fold = species_map(datasets)
    with args.subsets.open(encoding="utf-8", newline="") as f:
        subsets = {(r["factor"], r["term_id"]): r["subsets"].split(";")
                   for r in csv.DictReader(f, delimiter="\t")}

    labels = collections.defaultdict(dict)  # field -> {value id: label}
    missing = collections.Counter()
    rows = []
    for d in datasets:
        row = {"id": d["dataset_id"], "title": title_of(d)}
        species = {}
        for o in d["organism"]:
            sid, slabel = fold[o["ontology_term_id"]]
            species.setdefault(sid, slabel)
        row["organism"] = list(species)
        labels["organism"].update(species)

        for factor in FACTORS:
            # source labels, for terms missing from the ancestor TSV (unresolved remappings)
            annotated = {o["ontology_term_id"]: o["label"] for o in d.get(factor) or []}
            terms = remapped_terms(d, factor, remap)
            for t in terms:
                if t not in hierarchy[factor]:
                    missing[f"{factor}:{t}"] += 1
                    labels[factor].setdefault(t, annotated.get(t, t))
            row[factor] = terms

        for field in TERM_FIELDS:
            values = term_values(d, field)
            row[field] = [v for v, _ in values]
            for v, label in values:
                labels[field].setdefault(v, label)

        row["suspension_type"] = list(dict.fromkeys(d.get("suspension_type") or [NA]))
        types = list(dict.fromkeys(o["tissue_type"] for o in d.get("tissue") or []
                                   if o.get("tissue_type")))
        row["tissue_type"] = types or [NA]
        for field in ("suspension_type", "tissue_type"):
            for v in row[field]:
                labels[field].setdefault(v, NA_LABEL if v == NA else v)

        src = {}
        for s in d["sources"]:
            src.setdefault(s["source"]["slug"], (s["source"]["name"], s.get("explorer_url") or ""))
        primary = d["source"]["slug"]  # primary resource first, its URL is the dataset's
        src[primary] = (src[primary][0], d.get("explorer_url") or src[primary][1])
        order = [primary] + [s for s in src if s != primary]
        row["source"] = order
        row["source_explorer_urls"] = [src[s][1] for s in order]
        labels["source"].update({s: src[s][0] for s in order})

        row["flags"] = [f for f, on in (("merged", d.get("merged")),
                                        ("multi_species", len(species) > 1)) if on]
        labels["flags"].update({f: FLAG_LABELS[f] for f in row["flags"]})

        row["cell_count"] = int(d.get("cell_count") or 0)
        row["explorer_url"] = d.get("explorer_url") or ""
        row["h5ad_url"] = next((a["url"] for a in d.get("assets") or []
                                if str(a.get("filetype", "")).upper() == "H5AD"), "")
        row["doi"] = d.get("collection_doi") or ""
        row["doi_label"] = d.get("collection_doi_label") or ""
        row["collection_name"] = d.get("collection_name") or ""
        rows.append(row)

    # Term table: the hierarchy of the factors, plain values for the other fields.
    term_rows = []
    for factor in FACTORS:
        for tid, (label, parents, ancestors) in hierarchy[factor].items():
            term_rows.append({"field": factor, "id": tid, "label": label,
                              "parent_ids": parents, "ancestor_ids": ancestors,
                              "subsets": subsets.get((factor, tid), [])})
    for field, values in labels.items():
        for tid, label in values.items():
            if field in FACTORS and tid in hierarchy[field]:
                continue
            term_rows.append({"field": field, "id": tid, "label": label,
                              "parent_ids": [], "ancestor_ids": [], "subsets": []})

    # Text search: title, ids and the labels of the values (not of their ancestors).
    term_label = {(r["field"], r["id"]): r["label"] for r in term_rows}
    for row in rows:
        bits = [row["title"], row["id"], row["doi"], row["doi_label"], row["collection_name"]]
        for field in ("organism", *FACTORS, *TERM_FIELDS, "source"):
            bits += [term_label[(field, v)] for v in row[field] if v != NA]
        row["search_blob"] = " | ".join(b for b in bits if b)

    args.out_datasets.parent.mkdir(parents=True, exist_ok=True)
    args.out_terms.parent.mkdir(parents=True, exist_ok=True)
    columns = list(rows[0])
    table = pa.table({c: pa.array([r[c] for r in rows],
                                  type=pa.list_(pa.string()) if c in LIST_COLUMNS
                                  else pa.int64() if c == "cell_count" else pa.string())
                      for c in columns})
    pq.write_table(table, args.out_datasets, compression="zstd")
    terms = pa.table({c: pa.array([r[c] for r in term_rows],
                                  type=pa.list_(pa.string()) if c.endswith("_ids")
                                  or c == "subsets" else pa.string())
                      for c in ("field", "id", "label", "parent_ids", "ancestor_ids", "subsets")})
    pq.write_table(terms, args.out_terms, compression="zstd")

    if missing:
        print(f"warning: {len(missing)} annotated terms not in the ancestor TSV (no roll-up): "
              + ", ".join(sorted(missing)))
    print(f"{len(rows)} datasets -> {args.out_datasets} "
          f"({args.out_datasets.stat().st_size / 1e6:.2f} MB)")
    print(f"{len(term_rows)} terms -> {args.out_terms} "
          f"({args.out_terms.stat().st_size / 1e6:.2f} MB)")
    hidden = collections.Counter(r["field"] for r in term_rows if r["subsets"])
    for field, n in collections.Counter(r["field"] for r in term_rows).items():
        print(f"  {field:<18} {n:>5} values" + (f", {hidden[field]} in subsets" if hidden[field] else ""))
    unknown = set(subsets) - {(r["field"], r["id"]) for r in term_rows}
    if unknown:
        print(f"warning: {len(unknown)} terms of the subset TSV are not in the ancestor TSV")


if __name__ == "__main__":
    main()
