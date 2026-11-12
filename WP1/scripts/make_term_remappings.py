"""Generate the term remapping file (TSV) from a CELLxGENE datasets JSON export.

Reference ontology: composite-metazoan Uberon. It removes taxon-specific terms wherever
possible and records them as xrefs of taxon-neutral terms, so annotations are remapped as:

  1. 'unknown'/'na' (an empty annotation counts as 'na')
                               -> root of the ontology for the factor (tissue: UBERON:0001062,
                                  cell type: CL:0000000, developmental stage: UBERON:0000105)
  2. cell line (CVCL_*)        -> excluded
  3. term in composite         -> kept as is (no row), even if another term xrefs it. Stub
                                  terms (an id without name nor parents, left by composite for
                                  terms merged into another one, e.g. ZFA:0009248) do not count.
  4. obsolete term with replaced_by
                               -> remapped to the replacement term(s) (e.g. CL:0000089 ->
                                  CL:0000016). Done before rule 5 because obsolete CL ids are
                                  often xrefs of taxon-specific terms (e.g. CL:0002371 'somatic
                                  cell' is an xref of 'somatic cell (zebrafish)').
  5. xref of composite term(s) -> remapped to the term(s) bearing the xref (e.g. HsapDv:0010000
                                  -> UBERON:0000066)
  6. otherwise (not in composite, not an xref: e.g. 'human' CL terms, CL terms newer than the
     release, ZFS stages, obsolete terms without replacement) -> action 'unresolved', because
     composite says nothing about such terms. Optionally, supplementary OBO files that still
     know these terms can be given with --extra-obo: the term is then remapped to its closest
     (= most specific) ancestors, found by climbing composite + the extra files (is_a +
     part_of), that are in composite or xref of a composite term, and in the factor's domain.

Factor domains (also used for the ontology roll-up): the subtree (is_a + part_of) of the factor
root, without BFO, NCBITaxon, COB and GO terms. Cell types (the subtree of CL:0000000) are
excluded from the tissue domain: composite makes CL:0000000 a subclass of 'anatomical
structure', and cell types are part_of organs, so without this rule cell types would roll up
into anatomy. A cell type annotated as tissue (e.g. a primary cell culture) is remapped within
the cell type domain. Targets outside the domain (e.g. from an xref or a manual row) are
reported as warnings.

Manual remappings (--manual, optional): a TSV with the columns factor, source_term_id, action
(remap/exclude), target_term_id, comment. Its rows replace the generated rows of the same
(factor, source_term_id); a term mapped to several targets has one row per target. Use it for
the terms that rules 1-6 leave unresolved or map badly: unlike the output TSV, it is not
overwritten when the script is re-run. Targets must be (non-obsolete) terms of composite.

OBO parsing: parents are is_a and part_of relations (FlyBase 'substage of', FBdv:00018001,
counts as part_of). Taxon-conditional relations (General Class Inclusion axioms, e.g.
'is_a: WBls:0000091 {gci_relation="in_taxon", ...}') are ignored: they only hold in one taxon.

Only composite-metazoan.obo is required; its path must be given with --composite (nothing is
downloaded; http://purl.obolibrary.org/obo/uberon/composite-metazoan.obo).
Works for any species/dataset: the input JSON only needs the scFAIR fields `organism`,
`tissue`, `cell_type`, `development_stage` (lists of {label, ontology_term_id}) and `dataset_id`.
A dataset with several organisms contributes to the `organisms` column of all its terms.
The output TSV can be edited by hand afterwards, but re-running overwrites it.

Usage: python WP1/scripts/make_term_remappings.py --composite composite-metazoan.obo
           --datasets F.json --out F.tsv [--extra-obo FILE [FILE ...]] [--manual MANUAL.tsv]
"""

import argparse
import collections
import csv
import json
import sys
from pathlib import Path

FACTORS = ("tissue", "cell_type", "development_stage")
UNKNOWN_VALUES = {"unknown", "na"}
FACTOR_ROOTS = {
    "tissue": "UBERON:0001062",
    "cell_type": "CL:0000000",
    "development_stage": "UBERON:0000105",
}
CELL_ROOT = FACTOR_ROOTS["cell_type"]
# Relations followed to find ancestors. part_of crosses into other kinds of entities (a cell
# type part_of an organ, an organ part_of a 'multicellular organism' that is a subclass of
# NCBITaxon terms), which in_domain() filters out.
ANCESTOR_RELS = {"is_a", "part_of"}
# Terms never used as targets nor roll-up levels (upper-level, taxa, organism, GO)
EXCLUDED_PREFIXES = ("BFO:", "NCBITaxon:", "COB:", "GO:")
# OBO relationship types read as part_of. FBdv:00018001 'substage of' is the only link between
# FlyBase stages and Uberon stages (e.g. 'day 1 of adulthood' substage of UBERON:0000066).
PART_OF_RELS = {"part_of", "FBdv:00018001"}
MANUAL_FIELDS = ("factor", "source_term_id", "action", "target_term_id", "comment")


def parse_obo(path):
    """Return {id: {id, name, parents [(rel, id)], xrefs, obsolete, replaced_by, subsets}} for
    [Term]s."""
    terms, cur = {}, None
    for line in path.open(encoding="utf-8"):
        line = line.rstrip("\n")
        if line == "[Term]":
            cur = {"parents": [], "xrefs": [], "obsolete": False, "name": "", "replaced_by": [],
                   "subsets": []}
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
        elif line.startswith("replaced_by: "):
            cur["replaced_by"].append(line[13:].split()[0])
        elif line.startswith("subset: "):
            cur["subsets"].append(line[8:].split()[0])
        elif line.startswith("xref: "):
            cur["xrefs"].append(line[6:].split()[0])
        elif "gci_relation" in line:
            continue  # taxon-conditional relation (GCI axiom)
        elif line.startswith("is_a: "):
            cur["parents"].append(("is_a", line[6:].split()[0]))
        elif line.startswith("relationship: "):
            rel, target = line[14:].split()[:2]
            if rel in PART_OF_RELS:
                cur["parents"].append(("part_of", target))
    return terms


def ancestors(term_id, graph, rels):
    seen, stack = set(), [term_id]
    while stack:
        for rel, p in graph.get(stack.pop(), {}).get("parents", []):
            if rel in rels and p not in seen:
                seen.add(p)
                stack.append(p)
    return seen


def ancestor_finder(graph, rels=ANCESTOR_RELS):
    """Memoised ancestors(term) over graph."""
    memo = {}

    def anc(term_id):
        if term_id not in memo:
            memo[term_id] = ancestors(term_id, graph, rels)
        return memo[term_id]
    return anc


def term_kind(term_id, factor, anc):
    """Domain a term of a factor belongs to: a cell type annotated as tissue is a cell type."""
    if factor == "tissue" and (term_id == CELL_ROOT or CELL_ROOT in anc(term_id)):
        return "cell_type"
    return factor


def in_domain(term_id, kind, anc):
    """Whether term_id is in the domain of kind (a factor): in the subtree of its root, not an
    excluded term, and for tissues not a cell type."""
    if term_id.startswith(EXCLUDED_PREFIXES):
        return False
    lineage = anc(term_id) | {term_id}
    if FACTOR_ROOTS[kind] not in lineage:
        return False
    return kind != "tissue" or CELL_ROOT not in lineage


def closest(term_id, anc, accept):
    """Most specific ancestors satisfying accept() (not ancestors of another accepted one)."""
    hits = {a for a in anc(term_id) if accept(a)}
    return sorted(h for h in hits if not any(h in anc(o) for o in hits if o != h))


def read_manual(path, in_composite):
    """Manual remappings: {(factor, source_term_id): [(action, target, comment), ...]}."""
    manual = collections.defaultdict(list)
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        missing = set(MANUAL_FIELDS) - set(reader.fieldnames or [])
        if missing:
            sys.exit(f"{path}: missing columns {sorted(missing)}")
        for n, r in enumerate(reader, start=2):
            r = {k: (v or "").strip() for k, v in r.items()}
            if r["factor"] not in FACTORS:
                sys.exit(f"{path}:{n}: factor must be one of {FACTORS}: {r['factor']!r}")
            if r["action"] == "remap" and r["target_term_id"] not in in_composite:
                sys.exit(f"{path}:{n}: target {r['target_term_id']!r} is not a term of composite")
            if r["action"] == "exclude" and r["target_term_id"]:
                sys.exit(f"{path}:{n}: action 'exclude' takes no target")
            if r["action"] not in ("remap", "exclude"):
                sys.exit(f"{path}:{n}: action must be 'remap' or 'exclude': {r['action']!r}")
            manual[(r["factor"], r["source_term_id"])].append(
                (r["action"], r["target_term_id"], r["comment"]))
    return manual


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--composite", type=Path, required=True,
                    help="path to composite-metazoan.obo (reference ontology)")
    ap.add_argument("--datasets", type=Path, required=True,
                    help="CELLxGENE-style datasets JSON export to remap")
    ap.add_argument("--out", type=Path, required=True, help="remapping TSV to write")
    ap.add_argument("--extra-obo", type=Path, nargs="*", default=[],
                    help="supplementary OBO files used only to climb from terms absent from composite")
    ap.add_argument("--manual", type=Path,
                    help="TSV of manual remappings, overriding the generated rows of their terms")
    args = ap.parse_args()

    composite = parse_obo(args.composite)
    # Stubs (id only) are terms merged into another one: their id is an xref of that term.
    in_composite = {i for i, t in composite.items()
                    if not t["obsolete"] and (t["name"] or t["parents"])}
    xref_of = collections.defaultdict(set)  # xref id -> composite terms bearing it
    for t in composite.values():
        if t["id"] in in_composite:
            for x in t["xrefs"]:
                xref_of[x].add(t["id"])
    manual = read_manual(args.manual, in_composite) if args.manual else {}

    # Parent graph used to climb from terms absent from composite: composite first, then the
    # optional extra files.
    graph = dict(composite)
    for path in args.extra_obo:
        for i, t in parse_obo(path).items():
            graph.setdefault(i, t)
    anc = ancestor_finder(graph)

    def name_of(t):
        return (composite.get(t) or graph.get(t) or {}).get("name", "")

    def targets_of(t):
        """Composite term(s) standing for t: itself, or the terms bearing it as xref."""
        return [t] if t in in_composite else sorted(xref_of.get(t, ()))

    usage = collections.defaultdict(lambda: {"datasets": set(), "organisms": set()})
    labels = {}
    for d in json.load(args.datasets.open()):
        for factor in FACTORS:
            # An empty annotation is treated as NA (some resources use empty lists)
            for o in d[factor] or [{"ontology_term_id": "na", "label": "na"}]:
                u = usage[(factor, o["ontology_term_id"])]
                u["datasets"].add(d["dataset_id"])
                u["organisms"].update(org["label"] for org in d["organism"])
                labels[o["ontology_term_id"]] = o["label"]

    rows = []

    def add(factor, term, action, target, via, method, comment=""):
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
            "comment": comment,
        })

    for factor, term in sorted(usage):
        replaced_by = [r for r in graph.get(term, {}).get("replaced_by", []) if targets_of(r)]
        if (factor, term) in manual:
            for action, target, comment in manual[(factor, term)]:
                add(factor, term, action, target, "", "manual", comment)
        elif term in UNKNOWN_VALUES:
            add(factor, term, "remap", FACTOR_ROOTS[factor], "", "unknown_to_ontology_root")
        elif term.startswith("CVCL_"):
            add(factor, term, "exclude", "", "", "cell_line_excluded")
        elif term in in_composite:
            continue
        elif graph.get(term, {}).get("obsolete") and replaced_by:
            for r in replaced_by:
                for t in targets_of(r):
                    add(factor, term, "remap", t, r if r != t else "", "obsolete_replaced_by")
        elif term in xref_of:
            for t in sorted(xref_of[term]):
                add(factor, term, "remap", t, "", "xref_in_composite")
        else:
            kind = term_kind(term, factor, anc)
            hits = closest(term, anc,
                           lambda a: any(in_domain(t, kind, anc) for t in targets_of(a)))
            if not hits:
                add(factor, term, "unresolved", "", "", "no_ancestor_in_composite")
            for h in hits:
                for t in targets_of(h):
                    if in_domain(t, kind, anc):
                        add(factor, term, "remap", t, h, "closest_ancestor_in_composite")

    off = [r for r in rows if r["action"] == "remap" and not in_domain(
        r["target_term_id"], term_kind(r["source_term_id"], r["factor"], anc), anc)]
    if off:
        print(f"warning: {len(off)} targets outside the domain of their factor: "
              + ", ".join(f"{r['factor']}:{r['source_term_id']}->{r['target_term_id']} ({r['method']})"
                          for r in off))

    unused = sorted(set(manual) - set(usage))
    if unused:
        print(f"warning: {len(unused)} manual remappings for terms used by no dataset: "
              + ", ".join(f"{f}:{t}" for f, t in unused))

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
