import { useEffect, useState, type CSSProperties } from "react";
import {
  pivotCounts,
  type FacetField,
  type FacetSelection,
  type PivotResult,
} from "../catalogQuery";

export const PIVOT_FIELDS: { value: FacetField; label: string }[] = [
  { value: "source", label: "Source" },
  { value: "organism", label: "Organism" },
  { value: "top_organ", label: "Top organ" },
  { value: "tissue", label: "Tissue" },
  { value: "tissue_type", label: "Tissue type" },
  { value: "assay", label: "Assay" },
  { value: "disease", label: "Disease" },
  { value: "cell_type", label: "Cell type" },
  { value: "development_stage", label: "Development stage" },
  { value: "suspension_type", label: "Suspension" },
  { value: "sex", label: "Sex" },
  { value: "study_journal", label: "Journal" },
];

const STORAGE_KEY = "fenix-explore-pivot-axes";

function loadAxes(): { row: FacetField; col: FacetField } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { row?: string; col?: string };
      if (
        parsed.row &&
        parsed.col &&
        parsed.row !== parsed.col &&
        PIVOT_FIELDS.some((f) => f.value === parsed.row) &&
        PIVOT_FIELDS.some((f) => f.value === parsed.col)
      ) {
        return { row: parsed.row as FacetField, col: parsed.col as FacetField };
      }
    }
  } catch {
    // ignore
  }
  return { row: "organism", col: "top_organ" };
}

function cellStyle(count: number, max: number): CSSProperties {
  if (!count || max <= 0) {
    return { background: "rgba(255,255,255,0.55)", color: "var(--muted)" };
  }
  const t = Math.sqrt(count / max);
  const alpha = 0.18 + t * 0.72;
  return {
    background: `rgba(15, 106, 92, ${alpha.toFixed(3)})`,
    color: t > 0.55 ? "#f4fffb" : "var(--ink)",
    fontWeight: t > 0.35 ? 600 : 500,
  };
}

type Props = {
  query: string;
  facets: FacetSelection;
  onOpenHits: () => void;
  onApplyCell: (
    rowField: FacetField,
    rowValue: string,
    colField: FacetField,
    colValue: string
  ) => void;
};

export function PivotHeatmap({ query, facets, onApplyCell }: Props) {
  const [axes, setAxes] = useState(loadAxes);
  const [data, setData] = useState<PivotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(axes));
    } catch {
      // ignore
    }
  }, [axes]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      pivotCounts(axes.row, axes.col, query, facets)
        .then((result) => {
          if (!cancelled) {
            setData(result);
            setLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setLoading(false);
          }
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [axes, query, facets]);

  return (
    <div className="pivot-panel">
      <div className="pivot-controls">
        <label>
          Rows{" "}
          <select
            value={axes.row}
            onChange={(event) =>
              setAxes((prev) => ({
                ...prev,
                row: event.target.value as FacetField,
              }))
            }
          >
            {PIVOT_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Columns{" "}
          <select
            value={axes.col}
            onChange={(event) =>
              setAxes((prev) => ({
                ...prev,
                col: event.target.value as FacetField,
              }))
            }
          >
            {PIVOT_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        {data ? (
          <p className="pivot-meta">
            {data.found.toLocaleString()} datasets in filter · click a cell to
            open matching hits
          </p>
        ) : null}
      </div>
      {loading ? <p className="muted">Computing pivot…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {data && !loading ? (
        <div className="pivot-scroll">
          <table className="pivot-table">
            <thead>
              <tr>
                <th />
                {data.cols.map((col) => (
                  <th key={col} title={col}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIndex) => (
                <tr key={row}>
                  <th title={row}>{row}</th>
                  {data.cols.map((col, colIndex) => {
                    const count = data.matrix[rowIndex]?.[colIndex] ?? 0;
                    return (
                      <td key={col}>
                        <button
                          type="button"
                          className="pivot-cell"
                          style={cellStyle(count, data.maxCell)}
                          disabled={!count}
                          onClick={() => onApplyCell(axes.row, row, axes.col, col)}
                        >
                          {count || "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
