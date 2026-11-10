"""Generate the term remapping file (TSV) from a CELLxGENE datasets JSON export.

Reference ontology: composite-metazoan Uberon. It removes taxon-specific terms wherever
possible and records them as xrefs of taxon-neutral terms, so annotations are remapped as:

  1. 'unknown'/'na'            -> root of the ontology for the factor (cell type: CL:0000000,
                                  developmental stage: UBERON:0000105)
  2. cell line (CVCL_*)        -> excluded
  3. term in composite         -> kept as is (no row), even if another term xrefs it
  4. xref of composite term(s) -> remapped to the term(s) bearing the xref (e.g. HsapDv:0010000
                                  -> UBERON:0000066)
  5. otherwise (not in composite, not an xref: e.g. 'human' CL terms, CL terms newer than the
     release, ZFS stages) -> action 'unresolved', to be filled in by hand in the TSV, because
     composite says nothing about such terms. Optionally, supplementary OBO files that still
     know these terms can be given with --extra-obo: the term is then remapped to its closest
     (= most specific) ancestors, found by climbing composite + the extra files (is_a; also
     part_of for developmental stages), that are in composite or xref of a composite term.

Only composite-metazoan.obo is required; its path must be given with --composite (nothing is
downloaded; http://purl.obolibrary.org/obo/uberon/composite-metazoan.obo).
Works for any species/dataset: the input JSON only needs the scFAIR fields `organism`,
`tissue`, `cell_type`, `development_stage` (lists of {label, ontology_term_id}) and `dataset_id`.
The TSV can be edited by hand afterwards; re-running overwrites it.

Usage: python WP1/scripts/make_term_remappings.py --composite composite-metazoan.obo
           --datasets F.json --out F.tsv [--extra-obo FILE [FILE ...]]
"""

import argparse
import collections
import csv
import json
from pathlib import Path

FACTORS = ("tissue", "cell_type", "development_stage")
UNKNOWN_VALUES = {"unknown", "na"}
UNKNOWN_ROOTS = {"cell_type": "CL:0000000", "development_stage": "UBERON:0000105"}
# Relations followed to find ancestors. Stages form a partonomy (e.g. ZFS pharyngula:prim-5
# part_of pharyngula); for anatomy and cell types part_of would cross into other kinds of
# entities (a cell type part_of an organ), so only is_a is followed.
CLIMB_RELS = {"development_stage": {"is_a", "part_of"}, "tissue": {"is_a"}, "cell_type": {"is_a"}}


def parse_obo(path):
    terms, cur = {}, None
    for line in path.open(encoding="utf-8"):
        line = line.rstrip("\n")
        if line == "[Term]":
            cur = {"parents": [], "xrefs": [], "obsolete": False, "name": ""}
        elif line.startswith("["):
            cur = None
        elif cur is None:
            continue
        elif line.startswith("id: "):
            cur["id"] = line[4:]
            terms[cur["id"]] = cur
        elif line.startswith("name: "):
            cur["name"] = line[6:]
        elif line.startswith("is_obsolete: true"):
            cur["obsolete"] = True
        elif line.startswith("is_a: "):
            cur["parents"].append(("is_a", line[6:].split()[0]))
        elif line.startswith("relationship: part_of "):
            cur["parents"].append(("part_of", line[22:].split()[0]))
        elif line.startswith("xref: "):
            cur["xrefs"].append(line[6:].split()[0])
    return terms


def ancestors(term_id, graph, rels):
    seen, stack = set(), [term_id]
    while stack:
        for rel, p in graph.get(stack.pop(), {}).get("parents", []):
            if rel in rels and p not in seen:
                seen.add(p)
                stack.append(p)
    return seen


def closest(term_id, graph, rels, accept):
    """Most specific ancestors satisfying accept() (not ancestors of another accepted one)."""
    hits = {a for a in ancestors(term_id, graph, rels) if accept(a)}
    return sorted(h for h in hits if not any(h in ancestors(o, graph, rels) for o in hits if o != h))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--composite", type=Path, required=True,
                    help="path to composite-metazoan.obo (reference ontology)")
    ap.add_argument("--datasets", type=Path, required=True,
                    help="CELLxGENE-style datasets JSON export to remap")
    ap.add_argument("--out", type=Path, required=True, help="remapping TSV to write")
    ap.add_argument("--extra-obo", type=Path, nargs="*", default=[],
                    help="supplementary OBO files used only to climb from terms absent from composite")
    args = ap.parse_args()

    composite = parse_obo(args.composite)
    in_composite = {i for i, t in composite.items() if not t["obsolete"]}
    xref_of = collections.defaultdict(set)  # xref id -> composite terms bearing it
    for t in composite.values():
        if not t["obsolete"]:
            for x in t["xrefs"]:
                xref_of[x].add(t["id"])

    # Parent graph used to climb from terms absent from composite: composite first, then the
    # optional extra files.
    graph = dict(composite)
    for path in args.extra_obo:
        for i, t in parse_obo(path).items():
            graph.setdefault(i, t)

    def name_of(t):
        return (composite.get(t) or graph.get(t) or {}).get("name", "")

    def targets_of(t):
        """Composite term(s) standing for t: itself, or the terms bearing it as xref."""
        return [t] if t in in_composite else sorted(xref_of.get(t, ()))

    usage = collections.defaultdict(lambda: {"datasets": set(), "organisms": set()})
    labels = {}
    for d in json.load(args.datasets.open()):
        for factor in FACTORS:
            for o in d[factor]:
                u = usage[(factor, o["ontology_term_id"])]
                u["datasets"].add(d["dataset_id"])
                u["organisms"].add(d["organism"][0]["label"])
                labels[o["ontology_term_id"]] = o["label"]

    rows = []

    def add(factor, term, action, target, via, method):
        u = usage[(factor, term)]
        rows.append({
            "factor": factor,
            "source_term_id": term,
            "source_label": labels[term],
            "action": action,
            "target_term_id": target,
            "target_label": name_of(target) if target else "",
            "via_term_id": via,
            "via_label": name_of(via) if via else "",
            "method": method,
            "n_datasets": len(u["datasets"]),
            "organisms": ";".join(sorted(u["organisms"])),
        })

    for factor, term in sorted(usage):
        if term in UNKNOWN_VALUES:
            if factor in UNKNOWN_ROOTS:
                add(factor, term, "remap", UNKNOWN_ROOTS[factor], "", "unknown_to_ontology_root")
        elif term.startswith("CVCL_"):
            add(factor, term, "exclude", "", "", "cell_line_excluded")
        elif term in in_composite:
            continue
        elif term in xref_of:
            for t in sorted(xref_of[term]):
                add(factor, term, "remap", t, "", "xref_in_composite")
        else:
            hits = closest(term, graph, CLIMB_RELS[factor],
                           lambda a: not a.startswith("BFO:") and bool(targets_of(a)))
            if not hits:
                add(factor, term, "unresolved", "", "", "no_ancestor_in_composite")
            for h in hits:
                for t in targets_of(h):
                    add(factor, term, "remap", t, h, "closest_ancestor_in_composite")

    fields = list(rows[0])
    with args.out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter="\t", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    counts = collections.Counter((r["method"], r["action"]) for r in rows)
    print(f"{len(rows)} rows -> {args.out}")
    for k, v in sorted(counts.items()):
        print(f"  {k[0]:<32}{k[1]:<11}{v}")


if __name__ == "__main__":
    main()
