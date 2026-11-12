"""Tag the terms of the ancestor TSV that belong to given subsets of the ontology.

Reads the term list of make_term_ancestors.py (annotated terms and their ancestors, per
factor) and writes the terms that are in one of the requested subsets of composite-metazoan
Uberon (e.g. non_informative, upper_level: abstract grouping classes). The explore page hides
these terms in the filter trees and in the roll-up columns of the pivot (more specific terms
are shown instead); in raw mode, terms annotated to datasets are still shown.

With --manual, hand-curated terms to hide are added (TSV with columns factor, term_id,
comment; the subset is 'manual'). They are validated against the ancestor TSV: a term that is
not in it (not annotated, not an ancestor of an annotated term) is reported and ignored.

Output TSV columns:
  factor        tissue, cell_type or development_stage
  term_id       term of composite
  term_label    its name in composite
  annotated     yes if a dataset is annotated with the term (after remapping), no if it is
                only an ancestor
  subsets       the requested subsets the term is in, and 'manual' (';'-separated)

The input files are not modified.

Usage: python WP1/scripts/make_term_subsets.py --composite composite-metazoan.obo
           --ancestors term_ancestors.tsv --subsets non_informative upper_level
           [--manual term_subsets_manual.tsv] --out F.tsv
"""

import argparse
import collections
import csv
import sys
from pathlib import Path

from make_term_remappings import FACTORS, parse_obo

MANUAL_SUBSET = "manual"
MANUAL_FIELDS = ("factor", "term_id", "comment")


def read_manual(path):
    """[(factor, term_id)] of the hand-curated file; exits on a malformed file."""
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        if tuple(reader.fieldnames or ()) != MANUAL_FIELDS:
            sys.exit(f"{path}: columns must be {', '.join(MANUAL_FIELDS)} (tab-separated)")
        out = []
        for n, r in enumerate(reader, start=2):
            if r["factor"] not in FACTORS:
                sys.exit(f"{path}:{n}: factor must be one of {', '.join(FACTORS)}")
            if not r["term_id"]:
                sys.exit(f"{path}:{n}: empty term_id")
            out.append((r["factor"], r["term_id"]))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--composite", type=Path, required=True,
                    help="path to composite-metazoan.obo (reference ontology)")
    ap.add_argument("--ancestors", type=Path, required=True,
                    help="term ancestor TSV written by make_term_ancestors.py")
    ap.add_argument("--subsets", nargs="+", required=True, metavar="SUBSET",
                    help="subset names as in the 'subset:' lines of the OBO file")
    ap.add_argument("--manual", type=Path,
                    help="hand-curated terms to hide (TSV: factor, term_id, comment)")
    ap.add_argument("--out", type=Path, required=True, help="subset TSV to write")
    args = ap.parse_args()

    composite = parse_obo(args.composite)
    wanted = set(args.subsets)
    with args.ancestors.open(encoding="utf-8", newline="") as f:
        terms = list(csv.DictReader(f, delimiter="\t"))

    manual = set(read_manual(args.manual)) if args.manual else set()
    known = {(t["factor"], t["term_id"]) for t in terms}
    for factor, term in sorted(manual - known):
        print(f"warning: manual term {factor}:{term} is not in the ancestor TSV, ignored")

    rows = []
    for t in terms:
        found = [s for s in composite.get(t["term_id"], {}).get("subsets", []) if s in wanted]
        if (t["factor"], t["term_id"]) in manual:
            found.append(MANUAL_SUBSET)
        if found:
            rows.append({"factor": t["factor"], "term_id": t["term_id"],
                         "term_label": t["term_label"], "annotated": t["annotated"],
                         "subsets": ";".join(sorted(set(found)))})

    with args.out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["factor", "term_id", "term_label", "annotated", "subsets"],
                           delimiter="\t", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    used = collections.Counter(s for r in rows for s in r["subsets"].split(";"))
    unused = sorted(wanted - set(used) - {MANUAL_SUBSET})
    if unused:
        print("warning: no term of the ancestor TSV is in subset(s): " + ", ".join(unused))
    print(f"{len(rows)} terms -> {args.out}")
    for factor in sorted({r["factor"] for r in rows}):
        fr = [r for r in rows if r["factor"] == factor]
        ann = [r["term_label"] for r in fr if r["annotated"] == "yes"]
        print(f"  {factor:<18} {len(fr):>4} terms, annotated: {', '.join(ann) or 'none'}")
    for s, n in sorted(used.items()):
        print(f"  subset {s}: {n}")


if __name__ == "__main__":
    main()
