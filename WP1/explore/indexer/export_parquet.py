#!/usr/bin/env python3
"""Export flattened experiment catalogs to Parquet for DuckDB-WASM.

Built-in sources:
  - Fenix (`--fenix-json`)
  - Single Cell Portal (`--scp-json`)

Additional partner JSON files (new-source ingest schema):

  python export_parquet.py --json my_partner=/path/to/datasets.json

Re-run this script whenever catalogs change, then refresh the Vite UI
(hard-refresh the browser so `/experiments.parquet` reloads).
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from catalog import (
    DEFAULT_FENIX_JSON,
    DEFAULT_SCP_JSON,
    flatten_fenix,
    flatten_partner,
    flatten_scp,
    load_fenix,
    load_partner,
    load_scp,
)
from ols_cell_type import (
    load_cache as load_cl_cache,
    warm_cache_for_curies as warm_cl_cache_for_curies,
)
from ols_tissue import (
    load_cache as load_ols_cache,
    warm_cache_for_curies,
    warm_cache_for_labels,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "ui" / "public" / "experiments.parquet"

HIERARCHY_RENAMES = {
    f"tissue_hierarchy.lvl{i}": f"tissue_hierarchy_lvl{i}" for i in range(6)
} | {
    f"cell_type_hierarchy.lvl{i}": f"cell_type_hierarchy_lvl{i}" for i in range(6)
}

LIST_FIELDS = [
    "organism",
    "top_organ",
    "tissue",
    "tissue_type",
    "assay",
    "disease",
    "suspension_type",
    "sex",
    "development_stage",
    "self_reported_ethnicity",
    "cell_type",
    *[f"tissue_hierarchy_lvl{i}" for i in range(6)],
    *[f"cell_type_hierarchy_lvl{i}" for i in range(6)],
]


def rename_doc(doc: dict[str, Any]) -> dict[str, Any]:
    return {HIERARCHY_RENAMES.get(key, key): value for key, value in doc.items()}


def parse_source_json(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError(
            f"--json expects SOURCE=PATH, got {value!r}"
        )
    source, path_str = value.split("=", 1)
    source = source.strip()
    path = Path(path_str.strip()).expanduser()
    if not source:
        raise argparse.ArgumentTypeError(f"empty source name in {value!r}")
    if not path_str.strip():
        raise argparse.ArgumentTypeError(f"empty path in {value!r}")
    return source, path


def collect_docs(
    *,
    fenix_json: Path,
    scp_json: Path,
    skip_fenix: bool,
    skip_scp: bool,
    extras: list[tuple[str, Path]],
    skip_ols: bool,
    refresh_ols: bool,
) -> list[dict[str, Any]]:
    fenix_records: list[dict[str, Any]] = []
    scp_records: list[dict[str, Any]] = []
    partner_records: list[tuple[str, list[dict[str, Any]]]] = []
    ols_cache: dict[str, Any] | None = None
    cl_cache: dict[str, Any] | None = None

    if not skip_fenix:
        if not fenix_json.is_file():
            raise FileNotFoundError(f"Missing Fenix JSON: {fenix_json}")
        fenix_records = load_fenix(fenix_json)

    if not skip_scp:
        if not scp_json.is_file():
            raise FileNotFoundError(f"Missing SCP JSON: {scp_json}")
        scp_records = load_scp(scp_json)

    for source, path in extras:
        if not path.is_file():
            raise FileNotFoundError(f"Missing partner JSON for {source}: {path}")
        partner_records.append((source, load_partner(path)))

    if not skip_ols and (fenix_records or scp_records or partner_records):
        print("Warming OLS tissue hierarchy cache…")
        curies: list[str] = []
        organ_labels: list[str] = []
        cl_curies: list[str] = []

        for exp in fenix_records:
            for tissue in exp.get("tissue") or []:
                if isinstance(tissue, dict):
                    if tissue.get("ontology_term_id"):
                        curies.append(str(tissue["ontology_term_id"]))
                    if tissue.get("top-organ-uberon"):
                        curies.append(str(tissue["top-organ-uberon"]))
            for cell in exp.get("cell_type") or []:
                if isinstance(cell, dict) and cell.get("ontology_term_id"):
                    cl_curies.append(str(cell["ontology_term_id"]))

        for study in scp_records:
            meta = study.get("metadata") if isinstance(study, dict) else {}
            for organ in (meta or {}).get("organ") or []:
                organ_labels.append(str(organ))

        for _source, records in partner_records:
            for exp in records:
                for tissue in exp.get("tissue") or []:
                    if isinstance(tissue, dict):
                        if tissue.get("ontology_term_id"):
                            curies.append(str(tissue["ontology_term_id"]))
                        if tissue.get("top-organ-uberon"):
                            curies.append(str(tissue["top-organ-uberon"]))
                    else:
                        organ_labels.append(str(tissue))
                for cell in exp.get("cell_type") or []:
                    if isinstance(cell, dict) and cell.get("ontology_term_id"):
                        cl_curies.append(str(cell["ontology_term_id"]))

        warm_cache_for_curies(
            curies, refresh=refresh_ols, sleep_s=0.05 if refresh_ols else 0.02
        )
        if organ_labels:
            warm_cache_for_labels(
                organ_labels,
                refresh=refresh_ols,
                sleep_s=0.05 if refresh_ols else 0.02,
            )
        ols_cache = load_ols_cache()

        print("Warming OLS cell-type (CL) hierarchy cache…")
        if cl_curies:
            warm_cl_cache_for_curies(
                cl_curies,
                refresh=refresh_ols,
                sleep_s=0.05 if refresh_ols else 0.02,
            )
        cl_cache = load_cl_cache()

    docs: list[dict[str, Any]] = []
    if fenix_records:
        fenix_docs = [
            rename_doc(flatten_fenix(record, ols_cache=ols_cache, cl_cache=cl_cache))
            for record in fenix_records
        ]
        docs.extend(fenix_docs)
        print(f"Prepared {len(fenix_docs)} Fenix docs from {fenix_json}")

    if scp_records:
        scp_docs = [
            rename_doc(flatten_scp(record, ols_cache=ols_cache, cl_cache=cl_cache))
            for record in scp_records
        ]
        docs.extend(scp_docs)
        print(f"Prepared {len(scp_docs)} SCP docs from {scp_json}")

    for source, records in partner_records:
        partner_docs = [
            rename_doc(
                flatten_partner(
                    record, source=source, ols_cache=ols_cache, cl_cache=cl_cache
                )
            )
            for record in records
        ]
        docs.extend(partner_docs)
        print(f"Prepared {len(partner_docs)} docs for source={source}")

    return docs


def docs_to_table(docs: list[dict[str, Any]]) -> pa.Table:
    if not docs:
        raise ValueError("No documents to export")

    columns: dict[str, list[Any]] = {key: [] for key in docs[0]}
    for doc in docs:
        for key in columns:
            value = doc.get(key)
            if key in LIST_FIELDS:
                if value is None:
                    columns[key].append([])
                elif isinstance(value, list):
                    columns[key].append([str(v) for v in value if v is not None])
                else:
                    columns[key].append([str(value)])
            else:
                columns[key].append(value)

    arrays: dict[str, pa.Array] = {}
    for key, values in columns.items():
        if key in LIST_FIELDS:
            arrays[key] = pa.array(values, type=pa.list_(pa.string()))
        elif key in {"cell_count", "feature_count", "published_at"}:
            arrays[key] = pa.array(values, type=pa.int64())
        else:
            arrays[key] = pa.array([None if v is None else str(v) for v in values])
    return pa.table(arrays)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fenix-json", type=Path, default=DEFAULT_FENIX_JSON)
    parser.add_argument("--scp-json", type=Path, default=DEFAULT_SCP_JSON)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--skip-fenix", action="store_true")
    parser.add_argument("--skip-scp", action="store_true")
    parser.add_argument(
        "--json",
        dest="extra_json",
        action="append",
        default=[],
        type=parse_source_json,
        metavar="SOURCE=PATH",
        help="Extra partner catalog (repeatable). Example: --json partner=./data.json",
    )
    parser.add_argument(
        "--skip-ols",
        action="store_true",
        help="Skip OLS hierarchy enrichment (hierarchy columns stay empty)",
    )
    parser.add_argument(
        "--refresh-ols",
        action="store_true",
        help="Re-query OLS even when cache entries exist",
    )
    args = parser.parse_args(argv)

    try:
        docs = collect_docs(
            fenix_json=args.fenix_json,
            scp_json=args.scp_json,
            skip_fenix=args.skip_fenix,
            skip_scp=args.skip_scp,
            extras=args.extra_json,
            skip_ols=args.skip_ols,
            refresh_ols=args.refresh_ols,
        )
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if not docs:
        print("Nothing to export.", file=sys.stderr)
        return 1

    table = docs_to_table(docs)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, args.out, compression="zstd")
    counts = Counter(str(d.get("source") or "unknown") for d in docs)
    size_mb = args.out.stat().st_size / (1024 * 1024)
    print(
        f"Wrote {len(docs)} rows "
        f"({', '.join(f'{k}={v}' for k, v in sorted(counts.items()))}) "
        f"→ {args.out} ({size_mb:.2f} MiB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
