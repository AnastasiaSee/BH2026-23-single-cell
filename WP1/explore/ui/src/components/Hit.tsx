import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { EllipsisChip } from "./EllipsisChip";

export type ExperimentHit = {
  objectID: string;
  title?: string;
  source?: string;
  organism?: string[];
  top_organ?: string[];
  tissue?: string[];
  assay?: string[];
  disease?: string[];
  cell_type?: string[];
  development_stage?: string[];
  suspension_type?: string[];
  cell_count?: number;
  feature_count?: number;
  explorer_url?: string;
  experiment_id?: string;
  study_journal?: string;
};

export function hitTitle(hit: ExperimentHit): string {
  return hit.title || hit.experiment_id || hit.objectID;
}

export function formatSource(source?: string): string {
  if (source === "scfair") return "scFair";
  return source || "unknown";
}

/**
 * Compact counts for chips/table.
 * Scaled coefficient under 10 → one decimal (1.5k, 1.3M); 10+ → integer (45k, 34M).
 */
export function formatCompactCount(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const formatScaled = (scaled: number) => {
    const rounded = Math.round(scaled * 10) / 10;
    return Math.abs(rounded) < 10 ? rounded.toFixed(1) : String(Math.round(scaled));
  };
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${formatScaled(n / 1000)}k`;
  if (abs < 1_000_000_000) return `${formatScaled(n / 1_000_000)}M`;
  return `${formatScaled(n / 1_000_000_000)}B`;
}

/** Attribute lists: at most 3 value chips, then a single +n chip. */
export function AttributeChips({
  values,
  limit = 3,
  chipMaxWidth = 110,
  wrap = true,
}: {
  values?: string[];
  limit?: number;
  chipMaxWidth?: number;
  wrap?: boolean;
}) {
  if (!values?.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }
  const shown = values.slice(0, limit);
  const rest = values.length - shown.length;
  return (
    <Stack
      direction="row"
      flexWrap={wrap ? "wrap" : "nowrap"}
      useFlexGap
      gap={0.5}
      sx={wrap ? undefined : { overflow: "hidden" }}
    >
      {shown.map((value) => (
        <EllipsisChip
          key={value}
          size="small"
          label={value}
          variant="outlined"
          maxWidth={chipMaxWidth}
        />
      ))}
      {rest > 0 ? <Chip size="small" label={`+${rest}`} variant="outlined" /> : null}
    </Stack>
  );
}

function FacetBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack spacing={0.25} minWidth={0}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} lineHeight={1.2}>
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export function Hit({ hit }: { hit: ExperimentHit }) {
  const title = hitTitle(hit);
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ p: 1.25, "&:last-child": { pb: 1.25 } }}>
        <Typography
          variant="subtitle1"
          component="h3"
          fontWeight={700}
          lineHeight={1.25}
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            mb: 0.75,
          }}
        >
          {hit.explorer_url ? (
            <Link href={hit.explorer_url} target="_blank" rel="noreferrer" underline="hover">
              {title}
            </Link>
          ) : (
            title
          )}
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5} mb={1}>
          {hit.source ? (
            <Chip size="small" color="primary" label={formatSource(hit.source)} />
          ) : null}
          <Tooltip title={(hit.cell_count ?? 0).toLocaleString()} enterDelay={400}>
            <Chip size="small" label={`${formatCompactCount(hit.cell_count ?? 0)} cells`} />
          </Tooltip>
          {hit.feature_count ? (
            <Tooltip title={hit.feature_count.toLocaleString()} enterDelay={400}>
              <Chip size="small" label={`${formatCompactCount(hit.feature_count)} features`} />
            </Tooltip>
          ) : null}
          {hit.study_journal && hit.study_journal !== "unknown" ? (
            <EllipsisChip
              size="small"
              variant="outlined"
              label={hit.study_journal}
              maxWidth={140}
            />
          ) : null}
        </Stack>
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={1}
          sx={{
            "& > *": {
              flex: "1 1 calc(50% - 8px)",
              minWidth: 0,
              maxWidth: "100%",
            },
          }}
        >
          <FacetBlock label="Organism">
            <AttributeChips values={hit.organism} />
          </FacetBlock>
          <FacetBlock label="Top organ">
            <AttributeChips values={hit.top_organ} />
          </FacetBlock>
          <FacetBlock label="Tissue">
            <AttributeChips values={hit.tissue} />
          </FacetBlock>
          <FacetBlock label="Assay">
            <AttributeChips values={hit.assay} />
          </FacetBlock>
          <FacetBlock label="Disease">
            <AttributeChips values={hit.disease} />
          </FacetBlock>
          <FacetBlock label="Cell type">
            <AttributeChips values={hit.cell_type} />
          </FacetBlock>
          <FacetBlock label="Dev. stage">
            <AttributeChips values={hit.development_stage} />
          </FacetBlock>
        </Stack>
      </CardContent>
    </Card>
  );
}
