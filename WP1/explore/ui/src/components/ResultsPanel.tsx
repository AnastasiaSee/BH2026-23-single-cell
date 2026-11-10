import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Checkbox,
  FormControl,
  InputLabel,
  Link,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Chip,
} from "@mui/material";
import type { ExperimentRow, FacetSelection } from "../catalogQuery";
import { EllipsisChip } from "./EllipsisChip";
import { GROUP_BY_OPTIONS, groupHits, type GroupByField } from "./groupBy";
import {
  AttributeChips,
  Hit,
  formatCompactCount,
  formatSource,
  hitTitle,
  type ExperimentHit,
} from "./Hit";
import { PivotHeatmap } from "./PivotHeatmap";
import type { ResultsView } from "./ViewToggle";

const GROUP_STORAGE_KEY = "scfair-explore-group-by";
const COLUMNS_STORAGE_KEY = "scfair-explore-table-columns";
const NONE_LABEL = "(none)";

type TableColumnId =
  | "title"
  | "source"
  | "organism"
  | "top_organ"
  | "assay"
  | "disease"
  | "cell_type"
  | "development_stage"
  | "cells";

const TABLE_COLUMNS: {
  id: TableColumnId;
  label: string;
  width: number;
  required?: boolean;
}[] = [
  { id: "title", label: "Title", width: 280, required: true },
  { id: "source", label: "Source", width: 88 },
  { id: "organism", label: "Organism", width: 120 },
  { id: "top_organ", label: "Top organ", width: 120 },
  { id: "assay", label: "Assay", width: 140 },
  { id: "disease", label: "Disease", width: 120 },
  { id: "cell_type", label: "Cell type", width: 140 },
  { id: "development_stage", label: "Dev. stage", width: 120 },
  { id: "cells", label: "Cells", width: 72 },
];

const DEFAULT_COLUMNS: TableColumnId[] = ["title", "organism", "cell_type"];

const COL_WIDTH: Record<TableColumnId, number> = Object.fromEntries(
  TABLE_COLUMNS.map((col) => [col.id, col.width])
) as Record<TableColumnId, number>;

const noWrapCellSx = (maxWidth: number) => ({
  maxWidth,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
  verticalAlign: "middle",
});

function TruncatedCell({
  text,
  maxWidth,
  children,
  align,
}: {
  text: string;
  maxWidth: number;
  children?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <TableCell align={align} sx={{ maxWidth, whiteSpace: "nowrap", verticalAlign: "middle" }}>
      <Tooltip title={text} enterDelay={400}>
        <Typography
          component="span"
          display="block"
          noWrap
          variant="inherit"
          sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {children ?? text}
        </Typography>
      </Tooltip>
    </TableCell>
  );
}

function loadStoredGroupBy(): GroupByField {
  try {
    const value = localStorage.getItem(GROUP_STORAGE_KEY);
    if (GROUP_BY_OPTIONS.some((option) => option.value === value)) {
      return value as GroupByField;
    }
  } catch {
    // ignore
  }
  return "none";
}

function loadStoredColumns(): TableColumnId[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    // Upgrade prior title-only default to the new default set.
    if (parsed.length === 1 && parsed[0] === "title") return DEFAULT_COLUMNS;
    const valid = parsed.filter((id): id is TableColumnId =>
      TABLE_COLUMNS.some((col) => col.id === id)
    );
    if (!valid.includes("title")) valid.unshift("title");
    return valid.length ? valid : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function groupDomId(key: string): string {
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `group-section-${slug || "none"}`;
}

type Props = {
  view: ResultsView;
  rows: ExperimentRow[];
  query: string;
  facets: FacetSelection;
  onOpenHits: () => void;
  onApplyFacet: (field: string, value: string) => void;
};

function ChipCell({
  maxWidth,
  children,
}: {
  maxWidth: number;
  children: ReactNode;
}) {
  return (
    <TableCell sx={{ maxWidth, whiteSpace: "nowrap", verticalAlign: "middle", overflow: "hidden" }}>
      {children}
    </TableCell>
  );
}

function HitRow({
  hit,
  visible,
}: {
  hit: ExperimentHit;
  visible: Set<TableColumnId>;
}) {
  const title = hitTitle(hit);
  const cellCount = hit.cell_count ?? 0;
  const cellsLabel = formatCompactCount(cellCount);
  const cellsTooltip = cellCount.toLocaleString();
  const titleTooltip =
    hit.study_journal && hit.study_journal !== "unknown"
      ? `${title} · ${hit.study_journal}`
      : title;

  return (
    <TableRow hover>
      {visible.has("title") ? (
        <TruncatedCell text={titleTooltip} maxWidth={COL_WIDTH.title}>
          {hit.explorer_url ? (
            <Link href={hit.explorer_url} target="_blank" rel="noreferrer" underline="hover">
              {title}
            </Link>
          ) : (
            title
          )}
        </TruncatedCell>
      ) : null}
      {visible.has("source") ? (
        <ChipCell maxWidth={COL_WIDTH.source}>
          {hit.source ? (
            <Chip size="small" color="primary" label={formatSource(hit.source)} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )}
        </ChipCell>
      ) : null}
      {visible.has("organism") ? (
        <ChipCell maxWidth={COL_WIDTH.organism}>
          <AttributeChips values={hit.organism} chipMaxWidth={100} wrap={false} />
        </ChipCell>
      ) : null}
      {visible.has("top_organ") ? (
        <ChipCell maxWidth={COL_WIDTH.top_organ}>
          <AttributeChips values={hit.top_organ} chipMaxWidth={100} wrap={false} />
        </ChipCell>
      ) : null}
      {visible.has("assay") ? (
        <ChipCell maxWidth={COL_WIDTH.assay}>
          <AttributeChips values={hit.assay} chipMaxWidth={110} wrap={false} />
        </ChipCell>
      ) : null}
      {visible.has("disease") ? (
        <ChipCell maxWidth={COL_WIDTH.disease}>
          <AttributeChips values={hit.disease} chipMaxWidth={100} wrap={false} />
        </ChipCell>
      ) : null}
      {visible.has("cell_type") ? (
        <ChipCell maxWidth={COL_WIDTH.cell_type}>
          <AttributeChips values={hit.cell_type} chipMaxWidth={110} wrap={false} />
        </ChipCell>
      ) : null}
      {visible.has("development_stage") ? (
        <ChipCell maxWidth={COL_WIDTH.development_stage}>
          <AttributeChips values={hit.development_stage} chipMaxWidth={100} wrap={false} />
        </ChipCell>
      ) : null}
      {visible.has("cells") ? (
        <TruncatedCell text={cellsTooltip} maxWidth={COL_WIDTH.cells} align="right">
          {cellsLabel}
        </TruncatedCell>
      ) : null}
    </TableRow>
  );
}

export function ResultsPanel({
  view,
  rows,
  query,
  facets,
  onOpenHits,
  onApplyFacet,
}: Props) {
  const [groupBy, setGroupBy] = useState<GroupByField>(() => loadStoredGroupBy());
  const [columns, setColumns] = useState<TableColumnId[]>(() => loadStoredColumns());
  const [activeChip, setActiveChip] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, groupBy);
    } catch {
      // ignore
    }
    setActiveChip(null);
  }, [groupBy]);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
    } catch {
      // ignore
    }
  }, [columns]);

  const visibleColumns = useMemo(
    () => TABLE_COLUMNS.filter((col) => columns.includes(col.id)),
    [columns]
  );
  const visibleIds = useMemo(() => new Set(columns), [columns]);

  const groups = useMemo(
    () => (view === "table" ? groupHits(rows, groupBy) : []),
    [view, rows, groupBy]
  );

  const topGroups = useMemo(() => {
    if (groupBy === "none") return [];
    return [...groups]
      .sort((a, b) => {
        const byCount = b.hits.length - a.hits.length;
        if (byCount !== 0) return byCount;
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      })
      .slice(0, 10);
  }, [groups, groupBy]);

  const focusGroup = (key: string, label: string) => {
    setActiveChip(key);
    if (groupBy === "none" || label === NONE_LABEL) return;
    onApplyFacet(groupBy, label);
    const el = document.getElementById(groupDomId(key));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onColumnsChange = (event: SelectChangeEvent<TableColumnId[]>) => {
    const value = event.target.value;
    const next = (typeof value === "string" ? value.split(",") : value) as TableColumnId[];
    const withTitle = next.includes("title") ? next : (["title", ...next] as TableColumnId[]);
    setColumns(withTitle);
  };

  if (view === "pivot") {
    return (
      <PivotHeatmap
        query={query}
        facets={facets}
        onOpenHits={onOpenHits}
        onApplyCell={(rowField, rowValue, colField, colValue) => {
          onApplyFacet(rowField, rowValue);
          onApplyFacet(colField, colValue);
          onOpenHits();
        }}
      />
    );
  }

  if (view === "cards") {
    return (
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={2}
        sx={{
          "& > *": {
            flex: { xs: "1 1 100%", md: "1 1 calc(50% - 8px)" },
            maxWidth: { md: "calc(50% - 8px)" },
          },
        }}
      >
        {rows.map((hit) => (
          <Hit key={hit.objectID} hit={hit} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        flexWrap="wrap"
        useFlexGap
      >
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="group-by-label">Group by</InputLabel>
          <Select
            labelId="group-by-label"
            label="Group by"
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as GroupByField)}
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="table-columns-label">Columns</InputLabel>
          <Select
            labelId="table-columns-label"
            multiple
            value={columns}
            onChange={onColumnsChange}
            input={<OutlinedInput label="Columns" />}
            renderValue={(selected) =>
              TABLE_COLUMNS.filter((col) => selected.includes(col.id))
                .map((col) => col.label)
                .join(", ")
            }
          >
            {TABLE_COLUMNS.map((col) => (
              <MenuItem key={col.id} value={col.id} disabled={col.required}>
                <Checkbox checked={columns.includes(col.id)} disabled={col.required} />
                <ListItemText primary={col.label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {topGroups.length ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
            {topGroups.map((group) => (
              <EllipsisChip
                key={group.key}
                clickable
                color={activeChip === group.key ? "primary" : "default"}
                label={`${group.label} (${group.hits.length})`}
                maxWidth={200}
                onClick={() => focusGroup(group.key, group.label)}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>

      {groups.map((group) => (
        <Stack key={group.key} id={groupDomId(group.key)} spacing={1}>
          {groupBy !== "none" ? (
            <Typography variant="subtitle1" fontWeight={700}>
              {group.label}{" "}
              <Typography component="span" color="text.secondary">
                ({group.hits.length})
              </Typography>
            </Typography>
          ) : null}
          <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
              <TableHead>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col.id}
                      align={col.id === "cells" ? "right" : "left"}
                      sx={noWrapCellSx(col.width)}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {group.hits.map((hit) => (
                  <HitRow
                    key={`${group.key}-${hit.objectID}`}
                    hit={hit}
                    visible={visibleIds}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      ))}
    </Stack>
  );
}
