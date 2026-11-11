#!/usr/bin/env python3
"""Warm / refresh the OLS tissue hierarchy cache used by the exporter.

Examples:

    # Resolve all Fenix UBERON tissue IDs into ols_cache/uberon_paths.json
    python enrich_tissue_hierarchy.py

    # Force re-fetch from OLS (ignore cached paths)
    python enrich_tissue_hierarchy.py --refresh

Then re-export Parquet:

    python export_parquet.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ols_tissue import (
    CACHE_FILE,
    warm_cache_for_curies,
)

WP1 = Path(__file__).resolve().parents[2]


def fenix_tissue_curies(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("data") if isinstance(payload, dict) else payload
    curies: list[str] = []
    for exp in records or []:
        for tissue in exp.get("tissue") or []:
            if isinstance(tissue, dict) and tissue.get("ontology_term_id"):
                curies.append(str(tissue["ontology_term_id"]))
            top = tissue.get("top-organ-uberon") if isinstance(tissue, dict) else None
            if top:
                curies.append(str(top))
    return curies


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fenix-json",
        type=Path,
        default=WP1 / "fenix" / "experiments.json",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-query OLS even when a cache entry exists",
    )
    parser.add_argument("--sleep", type=float, default=0.05)
    args = parser.parse_args(argv)

    if not args.fenix_json.is_file():
        print(f"Missing Fenix JSON: {args.fenix_json}", file=sys.stderr)
        return 1

    curies = fenix_tissue_curies(args.fenix_json)
    print(f"Warming OLS cache for {len(set(curies))} unique Fenix tissue curies → {CACHE_FILE}")
    warm_cache_for_curies(curies, refresh=args.refresh, sleep_s=args.sleep)

    print(f"Done. Cache at {CACHE_FILE}")
    print("Re-export with: python export_parquet.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
