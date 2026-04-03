// Kampaign.ai — theme context
import { createContext, useContext, useEffect, useState } from "react";
import { darkTheme, lightTheme } from "./theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => {
    const root = document.documentElement;
    const vars = {
      "--k-bg":              theme.bg,
      "--k-bg2":             theme.bg2,
      "--k-card":            theme.card,
      "--k-card-border":     theme.cardBorder,
      "--k-sidebar":         theme.sidebar,
      "--k-sidebar-border":  theme.sidebarBorder,
      "--k-text":            theme.text,
      "--k-text-muted":      theme.textMuted,
      "--k-text-faint":      theme.textFaint,
      "--k-nav-active":      theme.navActive,
      "--k-nav-active-text": theme.navActiveText,
      "--k-table-row":       theme.tableRow,
      "--k-divider":         theme.divider,
      "--k-input":           theme.input,
      "--k-input-border":    theme.inputBorder,
      "--k-chart-grid":      theme.chartGrid,
      "--k-chart-text":      theme.chartText,
      "--k-tooltip-bg":      theme.tooltipBg,
      "--k-tooltip-border":  theme.tooltipBorder,
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("color-scheme", isDark ? "dark" : "light");
  }, [isDark, theme]);

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
