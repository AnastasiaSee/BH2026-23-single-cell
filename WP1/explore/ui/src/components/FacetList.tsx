import { useEffect, useState } from "react";
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
    <details
      className="ais-Panel"
      open={expanded}
      onToggle={(event) => setExpanded((event.target as HTMLDetailsElement).open)}
    >
      <summary className="ais-Panel-header">{title}</summary>
      <div className="ais-Panel-body">
        {searchable ? (
          <input
            className="facet-search"
            type="search"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        ) : null}
        {error ? <p className="facet-error">{error}</p> : null}
        <ul className="ais-RefinementList-list">
          {visible.map((row) => {
            const isChecked = selectedSet.has(row.value);
            return (
              <li key={row.value} className="ais-RefinementList-item">
                <label className="ais-RefinementList-label">
                  <input
                    className="ais-RefinementList-checkbox"
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(row.value)}
                  />
                  <span className="ais-RefinementList-labelText">{row.value}</span>
                  <span className="ais-RefinementList-count">{row.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {canShowMore ? (
          <button
            type="button"
            className="ais-RefinementList-showMore"
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    </details>
  );
}
