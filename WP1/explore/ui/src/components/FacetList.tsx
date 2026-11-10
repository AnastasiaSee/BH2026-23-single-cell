import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
      <AccordionDetails sx={{ pt: 0, px: 0 }}>
        {searchable ? (
          <TextField
            size="small"
            fullWidth
            type="search"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            sx={{ mb: 1, px: 1.5 }}
          />
        ) : null}
        {error ? (
          <Typography color="error" variant="caption" display="block" sx={{ mb: 1, px: 1.5 }}>
            {error}
          </Typography>
        ) : null}
        <List dense disablePadding>
          {visible.map((row) => {
            const labelId = `facet-${field}-${row.value}`;
            const checked = selectedSet.has(row.value);
            return (
              <ListItem key={row.value} disablePadding dense>
                <ListItemButton
                  role={undefined}
                  dense
                  onClick={() => onToggle(row.value)}
                  sx={{ py: 0.25, alignItems: "center" }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      size="small"
                      tabIndex={-1}
                      disableRipple
                      checked={checked}
                      inputProps={{ "aria-labelledby": labelId }}
                      sx={{ p: 0.5 }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    id={labelId}
                    primary={row.value}
                    primaryTypographyProps={{
                      variant: "body2",
                      sx: { wordBreak: "break-word" },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1, flexShrink: 0 }}>
                    {row.count}
                  </Typography>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
        {canShowMore ? (
          <Button size="small" onClick={() => setShowMore((value) => !value)} sx={{ mt: 1, ml: 1.5 }}>
            {showMore ? "Show less" : "Show more"}
          </Button>
        ) : null}
      </AccordionDetails>
    </Accordion>
  );
}
