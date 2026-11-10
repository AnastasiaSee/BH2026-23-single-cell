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

/** Attribute lists: at most 3 value chips, then a single +n chip. */
export function AttributeChips({
  values,
  limit = 3,
  chipMaxWidth = 140,
  wrap = true,
}: {
  values?: string[];
  limit?: number;
  chipMaxWidth?: number;
  wrap?: boolean;
}) {
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
            <EllipsisChip
              size="small"
              variant="outlined"
              label={hit.study_journal}
              maxWidth={180}
            />
          ) : null}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
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
        </Box>
      </CardContent>
    </Card>
  );
}
