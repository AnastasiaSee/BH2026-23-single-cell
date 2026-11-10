import { useEffect, useMemo, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Link,
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
import type { ExperimentRow, FacetSelection } from "../catalogQuery";
import { EllipsisChip } from "./EllipsisChip";
import { GROUP_BY_OPTIONS, groupHits, type GroupByField } from "./groupBy";
import { Hit, hitTitle, joinValues, type ExperimentHit } from "./Hit";
import { PivotHeatmap } from "./PivotHeatmap";
import type { ResultsView } from "./ViewToggle";

const GROUP_STORAGE_KEY = "scfair-explore-group-by";
const NONE_LABEL = "(none)";

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

function HitRow({ hit }: { hit: ExperimentHit }) {
  const title = hitTitle(hit);
  return (
    <TableRow hover>
      <TableCell>
        {hit.explorer_url ? (
          <Link href={hit.explorer_url} target="_blank" rel="noreferrer" underline="hover">
            {title}
          </Link>
        ) : (
          title
        )}
        {hit.study_journal && hit.study_journal !== "unknown" ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {hit.study_journal}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell>{hit.source || "—"}</TableCell>
      <TableCell>{joinValues(hit.organism)}</TableCell>
      <TableCell>{joinValues(hit.top_organ)}</TableCell>
      <TableCell>{joinValues(hit.assay)}</TableCell>
      <TableCell>{joinValues(hit.disease)}</TableCell>
      <TableCell>{joinValues(hit.cell_type)}</TableCell>
      <TableCell>{joinValues(hit.development_stage)}</TableCell>
      <TableCell align="right">{(hit.cell_count ?? 0).toLocaleString()}</TableCell>
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
  const [activeChip, setActiveChip] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, groupBy);
    } catch {
      // ignore
    }
    setActiveChip(null);
  }, [groupBy]);

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
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
          },
        }}
      >
        {rows.map((hit) => (
          <Hit key={hit.objectID} hit={hit} />
        ))}
      </Box>
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
        <Box key={group.key} id={groupDomId(group.key)}>
          {groupBy !== "none" ? (
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              {group.label}{" "}
              <Typography component="span" color="text.secondary">
                ({group.hits.length})
              </Typography>
            </Typography>
          ) : null}
          <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Organism</TableCell>
                  <TableCell>Top organ</TableCell>
                  <TableCell>Assay</TableCell>
                  <TableCell>Disease</TableCell>
                  <TableCell>Cell type</TableCell>
                  <TableCell>Dev. stage</TableCell>
                  <TableCell align="right">Cells</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.hits.map((hit) => (
                  <HitRow key={`${group.key}-${hit.objectID}`} hit={hit} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Stack>
  );
}
