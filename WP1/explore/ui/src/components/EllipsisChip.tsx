import { Chip, Tooltip, type ChipProps } from "@mui/material";

const DEFAULT_MAX_WIDTH = 140;

type Props = Omit<ChipProps, "label"> & {
  label: string;
  /** CSS max-width for the chip before ellipsis. */
  maxWidth?: number | string;
};

/** Chip with clipped label text and a tooltip for the full value. */
export function EllipsisChip({
  label,
  maxWidth = DEFAULT_MAX_WIDTH,
  sx,
  ...rest
}: Props) {
  return (
    <Tooltip title={label} enterDelay={400} describeChild>
      <Chip
        {...rest}
        label={label}
        sx={[
          {
            maxWidth,
            ".MuiChip-label": {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            },
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      />
    </Tooltip>
  );
}
