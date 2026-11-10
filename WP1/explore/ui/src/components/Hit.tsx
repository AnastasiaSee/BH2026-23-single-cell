import type { ReactNode } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";

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

export function joinValues(values?: string[], limit = 3): string {
  if (!values?.length) return "—";
  const shown = values.slice(0, limit);
  const rest = values.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(", ");
}

/** Attribute lists: at most 3 value chips, then a single +n chip. */
function chips(values?: string[], limit = 3) {
  if (!values?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }
  const shown = values.slice(0, limit);
  const rest = values.length - shown.length;
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5}>
      {shown.map((value) => (
        <Chip key={value} size="small" label={value} variant="outlined" />
      ))}
      {rest > 0 ? <Chip size="small" label={`+${rest}`} variant="outlined" /> : null}
    </Stack>
  );
}

function FacetBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Box mt={0.5}>{children}</Box>
    </Box>
  );
}

export function Hit({ hit }: { hit: ExperimentHit }) {
  const title = hitTitle(hit);
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" component="h3" gutterBottom>
          {hit.explorer_url ? (
            <Link href={hit.explorer_url} target="_blank" rel="noreferrer" underline="hover">
              {title}
            </Link>
          ) : (
            title
          )}
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} mb={2}>
          {hit.source ? (
            <Chip size="small" color="primary" label={formatSource(hit.source)} />
          ) : null}
          <Chip size="small" label={`${(hit.cell_count ?? 0).toLocaleString()} cells`} />
          {hit.feature_count ? (
            <Chip size="small" label={`${hit.feature_count.toLocaleString()} features`} />
          ) : null}
          {hit.study_journal && hit.study_journal !== "unknown" ? (
            <Chip size="small" variant="outlined" label={hit.study_journal} />
          ) : null}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <FacetBlock label="Organism">{chips(hit.organism)}</FacetBlock>
          <FacetBlock label="Top organ">{chips(hit.top_organ)}</FacetBlock>
          <FacetBlock label="Tissue">{chips(hit.tissue)}</FacetBlock>
          <FacetBlock label="Assay">{chips(hit.assay)}</FacetBlock>
          <FacetBlock label="Disease">{chips(hit.disease)}</FacetBlock>
          <FacetBlock label="Cell type">{chips(hit.cell_type)}</FacetBlock>
          <FacetBlock label="Dev. stage">{chips(hit.development_stage)}</FacetBlock>
        </Box>
      </CardContent>
    </Card>
  );
}
