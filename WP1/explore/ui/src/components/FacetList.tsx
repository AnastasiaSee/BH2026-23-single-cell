import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  facetCounts,
  type FacetCount,
  type FacetField,
  type FacetSelection,
} from "../catalogQuery";

type Props = {
  field: FacetField;
  title: string;
  query: string;
  facets: FacetSelection;
  selected: string[];
  searchable?: boolean;
  open?: boolean;
  limit?: number;
  onToggle: (value: string) => void;
};

export function FacetList({
  field,
  title,
  query,
  facets,
  selected,
  searchable = false,
  open = true,
  limit = 12,
  onToggle,
}: Props) {
  const [counts, setCounts] = useState<FacetCount[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(open);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      facetCounts(field, query, facets, showMore ? 100 : Math.max(limit, 40))
        .then((rows) => {
          if (!cancelled) {
            setCounts(rows);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [field, query, facets, showMore, limit]);

  const selectedSet = new Set(selected);
  const needle = filter.trim().toLowerCase();
  const filtered = needle
    ? counts.filter((row) => row.value.toLowerCase().includes(needle))
    : counts;
  const visible = showMore ? filtered : filtered.slice(0, limit);
  const canShowMore = filtered.length > limit;

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_, next) => setExpanded(next)}
      sx={{
        bgcolor: "transparent",
        borderBottom: 1,
        borderColor: "divider",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {searchable ? (
          <TextField
            size="small"
            fullWidth
            type="search"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            sx={{ mb: 1 }}
          />
        ) : null}
        {error ? (
          <Typography color="error" variant="caption" display="block" mb={1}>
            {error}
          </Typography>
        ) : null}
        <Stack spacing={0.25}>
          {visible.map((row) => (
            <Box
              key={row.value}
              component="label"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                width: "100%",
                cursor: "pointer",
                minHeight: 32,
              }}
            >
              <Checkbox
                size="small"
                checked={selectedSet.has(row.value)}
                onChange={() => onToggle(row.value)}
                sx={{ p: 0.5, flexShrink: 0 }}
              />
              <Typography
                variant="body2"
                sx={{ flex: 1, minWidth: 0, wordBreak: "break-word", lineHeight: 1.35 }}
              >
                {row.value}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flexShrink: 0, lineHeight: 1.35 }}
              >
                {row.count}
              </Typography>
            </Box>
          ))}
        </Stack>
        {canShowMore ? (
          <Button size="small" onClick={() => setShowMore((value) => !value)} sx={{ mt: 1 }}>
            {showMore ? "Show less" : "Show more"}
          </Button>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
