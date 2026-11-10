import { useEffect, useMemo, useState } from "react";
import { ResponsiveHeatMap } from "@nivo/heatmap";
import {
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
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

const NIVO_THEME = {
  text: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    fontSize: 11,
    fill: "#14212b",
  },
  axis: {
    ticks: {
      text: {
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        fontSize: 11,
        fill: "#5b6b78",
      },
    },
  },
  tooltip: {
    container: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      fontSize: 12,
    },
  },
} as const;

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

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row, rowIndex) => ({
      id: row,
      data: data.cols.map((col, colIndex) => ({
        x: col,
        y: data.matrix[rowIndex]?.[colIndex] ?? 0,
      })),
    }));
  }, [data]);

  const chartHeight = useMemo(() => {
    if (!data) return 360;
    return Math.min(720, Math.max(320, data.rows.length * 28 + 160));
  }, [data]);

  const chartMinWidth = useMemo(() => {
    if (!data) return 480;
    return Math.max(480, data.cols.length * 36 + 180);
  }, [data]);

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
        <Paper
          variant="outlined"
          sx={{ width: "100%", overflow: "auto", bgcolor: "rgba(255,255,255,0.72)" }}
        >
          <Stack sx={{ height: chartHeight, minWidth: chartMinWidth }}>
            <ResponsiveHeatMap
              data={chartData}
              margin={{ top: 110, right: 24, bottom: 52, left: 140 }}
              theme={NIVO_THEME}
              forceSquare={false}
              xInnerPadding={0.08}
              yInnerPadding={0.08}
              axisTop={{
                tickSize: 4,
                tickPadding: 8,
                tickRotation: -45,
              }}
              axisRight={null}
              axisBottom={null}
              axisLeft={{
                tickSize: 4,
                tickPadding: 8,
                tickRotation: 0,
              }}
              colors={{
                type: "sequential",
                colors: ["#e8f2ef", "#0f6a5c"],
                minValue: 0,
                maxValue: Math.max(1, data.maxCell),
              }}
              emptyColor="#f3f6f4"
              borderColor={{ from: "color", modifiers: [["darker", 0.15]] }}
              borderWidth={1}
              borderRadius={2}
              enableLabels
              labelTextColor={{
                from: "color",
                modifiers: [["darker", 2.2]],
              }}
              hoverTarget="cell"
              animate={false}
              isInteractive
              onClick={(cell) => {
                if (!cell.value) return;
                onApplyCell(axes.row, String(cell.serieId), axes.col, String(cell.data.x));
              }}
              tooltip={({ cell }) => (
                <Paper elevation={3} sx={{ px: 1.25, py: 0.75 }}>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {cell.serieId} × {String(cell.data.x)}
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {(cell.value ?? 0).toLocaleString()} datasets
                  </Typography>
                </Paper>
              )}
              legends={[
                {
                  anchor: "bottom",
                  translateX: 0,
                  translateY: 30,
                  length: 160,
                  thickness: 8,
                  direction: "row",
                  tickPosition: "after",
                  tickSize: 3,
                  tickSpacing: 4,
                  tickOverlap: false,
                  title: "Datasets",
                  titleAlign: "start",
                  titleOffset: 4,
                },
              ]}
            />
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
