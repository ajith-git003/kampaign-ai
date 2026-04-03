// Kampaign.ai — InsightCard component (collapsible)
import { useState } from "react";

const SEVERITY_STYLES = {
  info:     { border: "rgba(99,102,241,0.35)",  bg: "rgba(99,102,241,0.05)",  badgeBg: "rgba(99,102,241,0.15)",  badgeColor: "#a5b4fc" },
  warning:  { border: "rgba(245,158,11,0.35)",  bg: "rgba(245,158,11,0.05)",  badgeBg: "rgba(245,158,11,0.15)",  badgeColor: "#fbbf24" },
  critical: { border: "rgba(239,68,68,0.4)",    bg: "rgba(239,68,68,0.05)",   badgeBg: "rgba(239,68,68,0.15)",   badgeColor: "#f87171" },
};

const METRIC_COLORS = {
  ROAS:       { bg: "rgba(168,85,247,0.15)",  color: "#c084fc" },
  CTR:        { bg: "rgba(99,102,241,0.15)",  color: "#a5b4fc" },
  CPC:        { bg: "rgba(6,182,212,0.15)",   color: "#67e8f9" },
  SPEND:      { bg: "rgba(249,115,22,0.15)",  color: "#fb923c" },
  BUDGET:     { bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
  CONVERSION: { bg: "rgba(236,72,153,0.15)",  color: "#f472b6" },
  PURCHASE:   { bg: "rgba(236,72,153,0.15)",  color: "#f472b6" },
  CPM:        { bg: "rgba(99,102,241,0.15)",  color: "#818cf8" },
};

function getMetricStyle(tag) {
  const upper = (tag || "").toUpperCase();
  for (const [key, style] of Object.entries(METRIC_COLORS)) {
    if (upper.includes(key)) return style;
  }
  return { bg: "rgba(107,114,128,0.15)", color: "var(--k-text-muted)" };
}

function MetricBadge({ metric }) {
  if (!metric) return null;
  const ms = getMetricStyle(metric);
  return (
    <span
      className="inline-block text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: ms.bg, color: ms.color }}
    >
      {metric}
    </span>
  );
}

function parseInsightText(text) {
  if (!text) return [];
  const numbered = text.split(/\n?(?=\d+\.\s)/);
  const items = numbered.filter((s) => s.trim().length > 0);
  if (items.length <= 1) {
    return [{ raw: text, metric: null, issue: null, action: null, impact: null }];
  }
  const parsed = [];
  for (const item of items) {
    const metricMatch = item.match(/\[([^\]]+)\]/);
    const metric = metricMatch ? metricMatch[1] : null;
    const issueMatch  = item.match(/Issue:\s*([^]*?)(?=Action:|Expected impact:|$)/i);
    const actionMatch = item.match(/Action:\s*([^]*?)(?=Expected impact:|Issue:|$)/i);
    const impactMatch = item.match(/Expected impact:\s*([^]*?)(?=\d+\.|$)/i);
    const clean = (s) => s?.replace(/^\s+|\s+$/g, "").replace(/\n+/g, " ") || null;
    if (issueMatch || actionMatch || impactMatch) {
      parsed.push({ raw: item, metric, issue: clean(issueMatch?.[1]), action: clean(actionMatch?.[1]), impact: clean(impactMatch?.[1]) });
      continue;
    }
    const rawText = item.replace(/^\d+\.\s*/, "").replace(/\[[^\]]+\]\s*/, "").trim();
    if (!rawText || rawText.match(/^\d+\.?$/)) continue;
    parsed.push({ raw: rawText, metric, issue: null, action: null, impact: null });
  }
  return parsed;
}

// ── Single item row (collapsible action/impact) ───────────────────────────────

function ItemRow({ item, autoExpanded = false }) {
  const [open, setOpen] = useState(autoExpanded);
  const hasDetail = item.action || item.impact;
  const previewText = item.issue || item.raw || "";

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "var(--k-bg2)", border: "1px solid var(--k-divider)" }}
    >
      {/* Header row — always visible */}
      <div
        className={`flex items-center gap-2 px-3 py-2 ${hasDetail ? "cursor-pointer" : ""}`}
        onClick={() => hasDetail && setOpen((o) => !o)}
      >
        <MetricBadge metric={item.metric} />
        <span className="text-sm flex-1 truncate" style={{ color: "var(--k-text)" }}>
          {previewText}
        </span>
        {hasDetail && (
          <svg
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20" fill="currentColor"
            style={{ color: "var(--k-text-faint)" }}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Expanded detail */}
      {open && hasDetail && (
        <div className="px-3 pb-3 space-y-1.5 pt-1" style={{ borderTop: "1px solid var(--k-divider)" }}>
          {item.action && (
            <div className="flex gap-2 text-xs">
              <span className="uppercase tracking-wide shrink-0 w-12 pt-0.5" style={{ color: "var(--k-text-faint)" }}>Action</span>
              <span style={{ color: "var(--k-text-muted)" }}>{item.action}</span>
            </div>
          )}
          {item.impact && (
            <div className="flex gap-2 text-xs">
              <span className="uppercase tracking-wide shrink-0 w-12 pt-0.5" style={{ color: "var(--k-text-faint)" }}>Impact</span>
              <span className="text-emerald-400">{item.impact}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── InsightCard ───────────────────────────────────────────────────────────────

export default function InsightCard({ insight, isLatest = false }) {
  const [cardExpanded, setCardExpanded] = useState(isLatest);

  const s     = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
  const items = parseInsightText(insight.content);
  const dateStr = new Date(insight.created_at).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  // ── Collapsed view ──────────────────────────────────────────────────────────
  if (!cardExpanded) {
    const first = items[0];
    const preview = first?.issue || first?.raw || "";
    return (
      <div
        className="rounded-xl px-4 py-3 cursor-pointer transition-all"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}
        onClick={() => setCardExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <MetricBadge metric={first?.metric} />
          <span className="text-sm flex-1 truncate" style={{ color: "var(--k-text)" }}>
            {preview}
          </span>
          <span className="text-xs shrink-0" style={{ color: "var(--k-text-faint)" }}>{dateStr}</span>
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" style={{ color: "var(--k-text-faint)" }}>
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    );
  }

  // ── Expanded view ───────────────────────────────────────────────────────────
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      {/* Card header */}
      <div
        className={`flex justify-between items-center ${!isLatest ? "cursor-pointer" : ""}`}
        onClick={() => !isLatest && setCardExpanded(false)}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
            style={{ background: s.badgeBg, color: s.badgeColor }}
          >
            {insight.severity}
          </span>
          <span className="text-xs capitalize" style={{ color: "var(--k-text-muted)" }}>
            {insight.insight_type.replace(/_/g, " ")}
          </span>
          {isLatest && (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}
            >
              Latest
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--k-text-faint)" }}>{dateStr}</span>
          {!isLatest && (
            <svg className="w-3.5 h-3.5 rotate-180" viewBox="0 0 20 20" fill="currentColor" style={{ color: "var(--k-text-faint)" }}>
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Item rows — each collapsible for action/impact */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <ItemRow key={i} item={item} autoExpanded={isLatest && i === 0} />
        ))}
      </div>

      {insight.acknowledged && (
        <p className="text-xs" style={{ color: "var(--k-text-faint)" }}>✓ Acknowledged</p>
      )}
    </div>
  );
}
