import { createTheme } from "@mui/material/styles";

/** Teal palette — avoid default MUI purple. */
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f6a5c",
      dark: "#0a4f45",
      light: "#3d8f80",
      contrastText: "#f4fffb",
    },
    secondary: {
      main: "#2c4a5e",
    },
    background: {
      default: "#eef3f0",
      paper: "rgba(255,255,255,0.92)",
    },
    text: {
      primary: "#14212b",
      secondary: "#5b6b78",
    },
    divider: "rgba(20, 33, 43, 0.12)",
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontWeight: 700,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "radial-gradient(1200px 600px at 10% -10%, #d9efe8 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #e7eef5 0%, transparent 50%), linear-gradient(180deg, #eef3f0 0%, #f3f6f4 40%, #e8eee9 100%)",
          minHeight: "100vh",
        },
      },
    },
  },
});
