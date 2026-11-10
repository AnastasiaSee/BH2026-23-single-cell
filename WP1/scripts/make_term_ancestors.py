"""Expand the terms annotated to datasets (after remapping) to their ontology ancestors.

For each factor (tissue, cell type, developmental stage), the script applies the term
remappings (TSV from make_term_remappings.py) to the annotations of the datasets, then writes
one row per term of the factor's hierarchy: every annotated term and every ancestor of one.

Ancestors follow is_a and part_of in composite-metazoan Uberon (with the parsing rules of
make_term_remappings.py: FlyBase 'substage of' counts as part_of, taxon-conditional relations
are ignored) and are restricted to the domain of the factor:
  cell type            CL:0000000 and its descendants
  tissue               UBERON:0001062 and its descendants, except cell types (descendants
                       of CL:0000000)
  developmental stage  UBERON:0000105 and its descendants
and never BFO, NCBITaxon, COB or GO terms. A cell type annotated as tissue (e.g. a primary cell
culture) is a row of the tissue factor; its ancestors are the anatomical structures it is
part_of (none for some, e.g. myeloid cell).

Output TSV columns:
  factor        tissue, cell_type or development_stage
  term_id       term of composite
  term_label    its name in composite
  annotated     yes if a dataset is annotated with the term (after remapping), no if it is
                only an ancestor of annotated terms
  parent_ids    closest ancestors of the term within the domain (';'-separated): the
                hierarchy to use for drill-down (a transitive reduction of ancestor_ids)
  ancestor_ids  all its ancestors within the domain (';'-separated), the term excluded: a
                dataset annotated with the term counts for all of them in the roll-up

A term can be annotated (or an ancestor) in several factors and then has one row per factor.
Warnings report annotated terms that are not in composite (e.g. a remapping TSV generated from
other datasets) or outside the domain of their factor.

The input datasets JSON is not modified: the expansion is a separate layer.

Usage: python WP1/scripts/make_term_ancestors.py --composite composite-metazoan.obo
           --datasets datasets_merged.json --remappings term_remappings.tsv --out F.tsv
"""

import argparse
import collections
import csv
import json
from pathlib import Path

from make_term_remappings import (FACTORS, ancestor_finder, closest, in_domain, parse_obo,
                                  term_kind)


def read_remappings(path):
    """{(factor, source_term_id): [target terms]}; [] for an excluded term. Unresolved terms
    have no entry, so they stay as they are (and are reported if not in composite)."""
    remap = collections.defaultdict(list)
    with path.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f, delimiter="\t"):
            key = (r["factor"], r["source_term_id"])
            if r["action"] == "remap":
                remap[key].append(r["target_term_id"])
            elif r["action"] == "exclude":
                remap.setdefault(key, [])
    return dict(remap)


def remapped_terms(dataset, factor, remap):
    """Terms of a dataset for a factor after remapping, in order, without duplicates. An empty
    annotation is 'na', as in make_term_remappings.py."""
    terms = [o["ontology_term_id"] for o in dataset.get(factor) or []] or ["na"]
    return list(dict.fromkeys(t2 for t in terms for t2 in remap.get((factor, t), [t])))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--composite", type=Path, required=True,
                    help="path to composite-metazoan.obo (reference ontology)")
    ap.add_argument("--datasets", type=Path, required=True,
                    help="datasets JSON (the one the remapping TSV was generated from)")
    ap.add_argument("--remappings", type=Path, required=True,
                    help="term remapping TSV written by make_term_remappings.py")
    ap.add_argument("--out", type=Path, required=True, help="ancestor TSV to write")
    args = ap.parse_args()

    composite = parse_obo(args.composite)
    known = {i for i, t in composite.items() if not t["obsolete"] and (t["name"] or t["parents"])}
    anc = ancestor_finder(composite)
    remap = read_remappings(args.remappings)

    annotated = collections.defaultdict(set)  # factor -> terms
    for d in json.load(args.datasets.open(encoding="utf-8")):
        for factor in FACTORS:
            annotated[factor].update(remapped_terms(d, factor, remap))

    rows, problems = [], []
    for factor in FACTORS:
        nodes = {}  # term -> in-domain ancestors
        for t in sorted(annotated[factor]):
            if t not in known:
                problems.append(f"{factor}:{t} not in composite")
                continue
            if not in_domain(t, term_kind(t, factor, anc), anc):
                problems.append(f"{factor}:{t} outside the {factor} domain")
            nodes[t] = {a for a in anc(t) if in_domain(a, factor, anc)}
        for t in sorted(set().union(*nodes.values()) - set(nodes)):
            nodes[t] = {a for a in anc(t) if in_domain(a, factor, anc)}
        for t in sorted(nodes):
            parents = closest(t, anc, lambda a, s=nodes[t]: a in s)
            rows.append({
                "factor": factor,
                "term_id": t,
                "term_label": composite[t]["name"],
                "annotated": "yes" if t in annotated[factor] else "no",
                "parent_ids": ";".join(parents),
                "ancestor_ids": ";".join(sorted(nodes[t])),
            })

    with args.out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter="\t", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    if problems:
        print(f"warning: {len(problems)} annotated terms: " + ", ".join(problems))
    print(f"{len(rows)} rows -> {args.out}")
    for factor in FACTORS:
        fr = [r for r in rows if r["factor"] == factor]
        n_anc = sum(len(r["ancestor_ids"].split(";")) for r in fr if r["ancestor_ids"])
        print(f"  {factor:<18} {sum(r['annotated'] == 'yes' for r in fr):>5} annotated terms, "
              f"{len(fr):>5} terms with ancestors, {n_anc:>6} term-ancestor pairs")


if __name__ == "__main__":
    main()
