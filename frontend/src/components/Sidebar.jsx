// Kampaign.ai — Sidebar navigation
import { NavLink } from "react-router-dom";
import { useTheme } from "../ThemeContext";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    to: "/strategy",
    label: "Strategy",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    to: "/creatives",
    label: "Creatives",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { isDark, setIsDark } = useTheme();

  return (
    <aside
      style={{
        width: 210,
        background: "var(--k-sidebar)",
        borderRight: "1px solid var(--k-sidebar-border)",
      }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col"
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: "1px solid var(--k-sidebar-border)" }}>
        <span className="text-lg font-bold tracking-tight">
          <span style={{ color: "var(--k-nav-active-text)" }}>Kampaign</span>
          <span style={{ color: "var(--k-text)" }}>.ai</span>
        </span>
        <p className="text-xs mt-0.5" style={{ color: "var(--k-text-muted)" }}>
          AI-native campaign engine
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--k-nav-active-text)" : "var(--k-text-muted)",
              background: isActive ? "var(--k-nav-active)" : "transparent",
              textDecoration: "none",
              transition: "all 0.15s",
            })}
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: workspace + theme toggle */}
      <div className="px-4 pb-5 space-y-3" style={{ borderTop: "1px solid var(--k-sidebar-border)", paddingTop: 12 }}>
        {/* Workspace pill */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--k-nav-active)" }}
        >
          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            G
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "var(--k-text)" }}>Glowra Skincare</p>
            <p className="text-xs truncate" style={{ color: "var(--k-text-muted)" }}>DTC · India</p>
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setIsDark((d) => !d)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors"
          style={{ color: "var(--k-text-muted)" }}
        >
          <span className="text-xs">{isDark ? "Dark mode" : "Light mode"}</span>
          {/* Toggle switch */}
          <div
            className="relative w-8 h-4 rounded-full transition-colors shrink-0"
            style={{ background: isDark ? "#6366f1" : "var(--k-input-border)" }}
          >
            <div
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
              style={{ transform: isDark ? "translateX(17px)" : "translateX(2px)" }}
            />
          </div>
        </button>
      </div>
    </aside>
  );
}
