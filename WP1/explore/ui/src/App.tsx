import { useEffect, useMemo, useState } from "react";
import { FacetList } from "./components/FacetList";
import { ResultsPanel } from "./components/ResultsPanel";
import { ViewToggle, type ResultsView } from "./components/ViewToggle";
import {
  getConnection,
  searchRows,
  type ExperimentRow,
  type FacetField,
  type FacetSelection,
} from "./duckdb";

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
      <div className="shell">
        <header className="hero">
          <p className="eyebrow">WP1 explore</p>
          <h1>Single-cell catalogs</h1>
        </header>
        <p className="error">
          {bootError}
          <br />
          Export Parquet first:{" "}
          <code>python indexer/export_parquet.py</code>
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="shell">
        <header className="hero">
          <p className="eyebrow">WP1 explore</p>
          <h1>Single-cell catalogs</h1>
          <p className="lede">Loading Parquet into DuckDB-WASM…</p>
        </header>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">WP1 explore</p>
        <h1>Single-cell catalogs</h1>
        <p className="lede">
          Fully client-side explore over catalog Parquet — queried in the browser
          with DuckDB-WASM. Re-run{" "}
          <code>export_parquet.py</code> when JSON sources change.
        </p>
      </header>

      <div className="layout">
        <aside className="facets">
          <div className="facet-actions">
            <button
              type="button"
              className="ais-ClearRefinements-button"
              disabled={!activeRefinements.length && !query}
              onClick={() => {
                setQuery("");
                setFacets({});
              }}
            >
              Clear filters
            </button>
          </div>
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
        </aside>

        <main className="results">
          <div className="results-toolbar">
            <input
              className="search-box"
              type="search"
              placeholder="Search titles, tissues, assays…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ViewToggle value={view} onChange={setView} />
          </div>

          {activeRefinements.length ? (
            <ul className="current-refinements">
              {activeRefinements.map(({ field, value }) => (
                <li key={`${field}:${value}`}>
                  <button
                    type="button"
                    onClick={() => onToggleFacet(field as FacetField, value)}
                  >
                    {field}: {value} ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="results-meta">
            <p>
              {view === "pivot"
                ? "Pivot view"
                : searching
                  ? "Searching…"
                  : `${found.toLocaleString()} datasets`}
            </p>
          </div>

          {searchError ? <p className="error">{searchError}</p> : null}

          <ResultsPanel
            view={view}
            rows={rows}
            query={debouncedQuery}
            facets={facets}
            onOpenHits={() => setView("table")}
            onApplyFacet={onApplyFacet}
          />

          {view !== "pivot" && found > PAGE_SIZE ? (
            <div className="pagination">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
