import type { ReactNode } from "react";
import GridViewIcon from "@mui/icons-material/GridView";
import TableRowsIcon from "@mui/icons-material/TableRows";
import PivotTableChartIcon from "@mui/icons-material/PivotTableChart";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

export type ResultsView = "cards" | "table" | "pivot";

type Props = {
  value: ResultsView;
  onChange: (view: ResultsView) => void;
};

const OPTIONS: { id: ResultsView; label: string; icon: ReactNode }[] = [
  { id: "cards", label: "Cards", icon: <GridViewIcon fontSize="small" /> },
  { id: "table", label: "Table", icon: <TableRowsIcon fontSize="small" /> },
  { id: "pivot", label: "Pivot", icon: <PivotTableChartIcon fontSize="small" /> },
];

export function ViewToggle({ value, onChange }: Props) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      value={value}
      aria-label="Results layout"
      onChange={(_, next: ResultsView | null) => {
        if (next) onChange(next);
      }}
    >
      {OPTIONS.map((option) => (
        <ToggleButton key={option.id} value={option.id} aria-label={option.label}>
          {option.icon}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
