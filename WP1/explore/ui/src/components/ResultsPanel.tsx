import { useEffect, useMemo, useState } from "react";
import type { ExperimentRow, FacetSelection } from "../catalogQuery";
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
    <tr>
      <td className="title-cell">
        {hit.explorer_url ? (
          <a href={hit.explorer_url} target="_blank" rel="noreferrer">
            {title}
          </a>
        ) : (
          title
        )}
        {hit.study_journal && hit.study_journal !== "unknown" ? (
          <span className="row-sub">{hit.study_journal}</span>
        ) : null}
      </td>
      <td>{hit.source || "—"}</td>
      <td>{joinValues(hit.organism, 2)}</td>
      <td>{joinValues(hit.top_organ, 2)}</td>
      <td>{joinValues(hit.assay, 2)}</td>
      <td>{joinValues(hit.disease, 2)}</td>
      <td>{joinValues(hit.cell_type, 2)}</td>
      <td>{joinValues(hit.development_stage, 2)}</td>
      <td className="num">{(hit.cell_count ?? 0).toLocaleString()}</td>
    </tr>
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
      <div className="hits-grid">
        {rows.map((hit) => (
          <Hit key={hit.objectID} hit={hit} />
        ))}
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <label>
          Group by{" "}
          <select
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as GroupByField)}
          >
            {GROUP_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {topGroups.length ? (
          <div className="group-chips" aria-label="Top groups">
            {topGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                className={
                  activeChip === group.key ? "group-chip is-active" : "group-chip"
                }
                onClick={() => focusGroup(group.key, group.label)}
              >
                {group.label}
                <span>{group.hits.length}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {groups.map((group) => (
        <section key={group.key} id={groupDomId(group.key)} className="group-section">
          {groupBy !== "none" ? (
            <h3 className="group-heading">
              {group.label}{" "}
              <span className="muted">({group.hits.length})</span>
            </h3>
          ) : null}
          <table className="results-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Organism</th>
                <th>Top organ</th>
                <th>Assay</th>
                <th>Disease</th>
                <th>Cell type</th>
                <th>Dev. stage</th>
                <th>Cells</th>
              </tr>
            </thead>
            <tbody>
              {group.hits.map((hit) => (
                <HitRow key={`${group.key}-${hit.objectID}`} hit={hit} />
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
