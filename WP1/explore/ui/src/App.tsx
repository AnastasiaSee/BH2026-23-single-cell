import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import { FacetList } from "./components/FacetList";
import { ResultsPanel } from "./components/ResultsPanel";
import { ViewToggle, type ResultsView } from "./components/ViewToggle";
import {
  getConnection,
  searchRows,
  type ExperimentRow,
  type FacetField,
  type FacetSelection,
} from "./catalogQuery";

const PAGE_SIZE = 24;

const FACET_PANELS: {
  field: FacetField;
  title: string;
  searchable?: boolean;
  open?: boolean;
  limit?: number;
}[] = [
  { field: "source", title: "Source" },
  { field: "organism", title: "Organism" },
  { field: "top_organ", title: "Top organ", searchable: true },
  { field: "tissue_hierarchy_lvl0", title: "Tissue hierarchy", searchable: true },
  {
    field: "tissue",
    title: "Tissue (flat)",
    searchable: true,
    open: false,
  },
  { field: "tissue_type", title: "Tissue type", open: false },
  { field: "assay", title: "Assay", searchable: true },
  { field: "disease", title: "Disease", searchable: true },
  {
    field: "cell_type_hierarchy_lvl0",
    title: "Cell type hierarchy",
    searchable: true,
  },
  {
    field: "cell_type",
    title: "Cell type (flat)",
    searchable: true,
    open: false,
  },
  {
    field: "development_stage",
    title: "Development stage",
    searchable: true,
    open: false,
  },
  { field: "suspension_type", title: "Suspension" },
  { field: "sex", title: "Sex" },
  {
    field: "study_journal",
    title: "Journal",
    searchable: true,
    open: false,
  },
];

function toggleValue(values: string[] | undefined, value: string): string[] {
  const current = values ?? [];
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [facets, setFacets] = useState<FacetSelection>({});
  const [view, setView] = useState<ResultsView>("cards");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ExperimentRow[]>([]);
  const [found, setFound] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getConnection()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setBootError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, facets]);

  useEffect(() => {
    if (!ready || view === "pivot") return;
    let cancelled = false;
    setSearching(true);
    searchRows(debouncedQuery, facets, {
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (!cancelled) {
          setRows(result.rows);
          setFound(result.found);
          setSearchError(null);
          setSearching(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : String(err));
          setSearching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ready, debouncedQuery, facets, page, view]);

  const activeRefinements = useMemo(
    () =>
      Object.entries(facets).flatMap(([field, values]) =>
        values.map((value) => ({ field, value }))
      ),
    [facets]
  );

  const pageCount = Math.max(1, Math.ceil(found / PAGE_SIZE));

  const onToggleFacet = (field: FacetField, value: string) => {
    setFacets((prev) => {
      const next = { ...prev, [field]: toggleValue(prev[field], value) };
      if (!next[field]?.length) {
        delete next[field];
      }
      return next;
    });
  };

  const onApplyFacet = (field: string, value: string) => {
    if (value === "(none)") return;
    onToggleFacet(field as FacetField, value);
  };

  if (bootError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h1" fontSize={{ xs: "2rem", md: "2.75rem" }} gutterBottom>
          scFair datasets
        </Typography>
        <Alert severity="error">
          {bootError}
          <Box component="span" display="block" mt={1}>
            Export Parquet first: <code>python indexer/export_parquet.py</code>
          </Box>
        </Alert>
      </Container>
    );
  }

  if (!ready) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h1" fontSize={{ xs: "2rem", md: "2.75rem" }} gutterBottom>
          scFair datasets
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading catalog…</Typography>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: 8 }}>
      <Box mb={3}>
        <Typography variant="h1" fontSize={{ xs: "2rem", md: "2.75rem" }} gutterBottom>
          scFair datasets
        </Typography>
        <Typography color="text.secondary" maxWidth="42rem">
          Browse and filter single-cell datasets by organism, tissue, assay, and more.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.5, position: { md: "sticky" }, top: { md: 16 } }}>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            disabled={!activeRefinements.length && !query}
            onClick={() => {
              setQuery("");
              setFacets({});
            }}
            sx={{ mb: 1 }}
          >
            Clear filters
          </Button>
          {FACET_PANELS.map((panel) => (
            <FacetList
              key={panel.field}
              field={panel.field}
              title={panel.title}
              query={debouncedQuery}
              facets={facets}
              selected={facets[panel.field] ?? []}
              searchable={panel.searchable}
              open={panel.open}
              limit={panel.limit}
              onToggle={(value) => onToggleFacet(panel.field, value)}
            />
          ))}
        </Paper>

        <Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
            mb={2}
          >
            <TextField
              fullWidth
              size="small"
              type="search"
              placeholder="Search titles, tissues, assays…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <ViewToggle value={view} onChange={setView} />
          </Stack>

          {activeRefinements.length ? (
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} mb={2}>
              {activeRefinements.map(({ field, value }) => (
                <Chip
                  key={`${field}:${value}`}
                  label={`${field}: ${value}`}
                  onDelete={() => onToggleFacet(field as FacetField, value)}
                />
              ))}
            </Stack>
          ) : null}

          <Typography variant="body2" color="text.secondary" mb={1.5}>
            {view === "pivot"
              ? "Pivot view"
              : searching
                ? "Searching…"
                : `${found.toLocaleString()} datasets`}
          </Typography>

          {searchError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {searchError}
            </Alert>
          ) : null}

          <ResultsPanel
            view={view}
            rows={rows}
            query={debouncedQuery}
            facets={facets}
            onOpenHits={() => setView("table")}
            onApplyFacet={onApplyFacet}
          />

          {view !== "pivot" && found > PAGE_SIZE ? (
            <Stack alignItems="center" mt={3}>
              <Pagination
                color="primary"
                page={page + 1}
                count={pageCount}
                onChange={(_, next) => setPage(next - 1)}
              />
            </Stack>
          ) : null}
        </Box>
      </Box>
    </Container>
  );
}
