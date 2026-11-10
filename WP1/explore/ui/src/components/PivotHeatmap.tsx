import { useEffect, useState, type CSSProperties } from "react";
import {
  Alert,
  ButtonBase,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
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

const STORAGE_KEY = "scfair-explore-pivot-axes";

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
    return { background: "rgba(255,255,255,0.55)", color: "#5b6b78" };
  }
  const t = Math.sqrt(count / max);
  const alpha = 0.18 + t * 0.72;
  return {
    background: `rgba(15, 106, 92, ${alpha.toFixed(3)})`,
    color: t > 0.55 ? "#f4fffb" : "#14212b",
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
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="pivot-rows-label">Rows</InputLabel>
          <Select
            labelId="pivot-rows-label"
            label="Rows"
            value={axes.row}
            onChange={(event) =>
              setAxes((prev) => ({ ...prev, row: event.target.value as FacetField }))
            }
          >
            {PIVOT_FIELDS.map((field) => (
              <MenuItem key={field.value} value={field.value}>
                {field.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="pivot-cols-label">Columns</InputLabel>
          <Select
            labelId="pivot-cols-label"
            label="Columns"
            value={axes.col}
            onChange={(event) =>
              setAxes((prev) => ({ ...prev, col: event.target.value as FacetField }))
            }
          >
            {PIVOT_FIELDS.map((field) => (
              <MenuItem key={field.value} value={field.value}>
                {field.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {data ? (
          <Typography variant="body2" color="text.secondary">
            {data.found.toLocaleString()} datasets in filter · click a cell to open matching
            hits
          </Typography>
        ) : null}
      </Stack>

      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Computing pivot…
          </Typography>
        </Stack>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      {data && !loading ? (
        <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2, maxWidth: "100%", overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                {data.cols.map((col) => (
                  <TableCell key={col} title={col} sx={{ whiteSpace: "nowrap" }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((row, rowIndex) => (
                <TableRow key={row}>
                  <TableCell component="th" scope="row" title={row} sx={{ whiteSpace: "nowrap" }}>
                    {row}
                  </TableCell>
                  {data.cols.map((col, colIndex) => {
                    const count = data.matrix[rowIndex]?.[colIndex] ?? 0;
                    return (
                      <TableCell key={col} padding="none">
                        <ButtonBase
                          disabled={!count}
                          onClick={() => onApplyCell(axes.row, row, axes.col, col)}
                          sx={{
                            width: "100%",
                            minWidth: 44,
                            py: 1,
                            px: 0.75,
                            ...cellStyle(count, data.maxCell),
                          }}
                        >
                          {count || "·"}
                        </ButtonBase>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Stack>
  );
}
