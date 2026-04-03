// Kampaign.ai — MetricCard component

const BORDER_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#a855f7", // purple
];

export default function MetricCard({ label, value, delta, deltaLabel, colorIndex = 0 }) {
  const isPositive = typeof delta === "number" ? delta >= 0 : null;
  const accentColor = BORDER_COLORS[colorIndex % BORDER_COLORS.length];

  return (
    <div
      className="rounded-xl p-5 space-y-1 relative overflow-hidden"
      style={{
        background: "var(--k-card)",
        border: "1px solid var(--k-card-border)",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      <p
        className="text-xs uppercase tracking-wider font-medium"
        style={{ color: "var(--k-text-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: "var(--k-text)", letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      {delta != null && (
        <p className={`text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {isPositive ? "▲" : "▼"} {Math.abs(delta)}%{" "}
          <span style={{ color: "var(--k-text-muted)" }}>{deltaLabel ?? "vs last period"}</span>
        </p>
      )}
    </div>
  );
}
