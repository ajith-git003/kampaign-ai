// Kampaign.ai — Analytics page
import { useEffect, useState } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CAMPAIGN_COLORS = [
  "#6366f1", "#22c55e", "#ef4444", "#f59e0b",
  "#a855f7", "#06b6d4", "#f97316", "#ec4899",
];

const inr = (n) => typeof n === "number" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";
const pct = (n) => typeof n === "number" ? `${n.toFixed(2)}%` : "—";
const roasFmt = (n) => typeof n === "number" ? `${n.toFixed(2)}x` : "—";

function shortName(name = "") {
  return name.length > 18 ? name.slice(0, 16) + "…" : name;
}
function toYMD(d) { return d.toISOString().slice(0, 10); }
function todayYMD() { return toYMD(new Date()); }
function daysAgoYMD(n) { const d = new Date(); d.setDate(d.getDate() - n); return toYMD(d); }

const QUICK_RANGES = [
  { label: "Last 7 days",  start: () => daysAgoYMD(7),   end: todayYMD },
  { label: "Last 30 days", start: () => daysAgoYMD(30),  end: todayYMD },
  { label: "Last 90 days", start: () => daysAgoYMD(90),  end: todayYMD },
  { label: "All Time",     start: () => "2025-10-01",     end: todayYMD },
];

// ── Shared card wrapper ───────────────────────────────────────────────────────

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl p-5 space-y-4 ${className}`}
      style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-base font-semibold" style={{ color: "var(--k-text)" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--k-text-muted)" }}>{subtitle}</p>}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }) {
  return (
    <div className="rounded-xl p-5 space-y-1" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}>
      <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--k-text-muted)" }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--k-text)", letterSpacing: "-0.02em" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--k-text-faint)" }}>{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 space-y-2 animate-pulse" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}>
      <div className="h-3 w-24 rounded" style={{ background: "var(--k-divider)" }} />
      <div className="h-7 w-32 rounded" style={{ background: "var(--k-divider)" }} />
    </div>
  );
}

function SkeletonBlock({ h = "h-64" }) {
  return <div className={`rounded-xl ${h} animate-pulse`} style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }} />;
}

function StatusBadge({ label }) {
  const styles = {
    top:             { bg: "rgba(16,185,129,0.12)", color: "#34d399",  border: "rgba(16,185,129,0.3)" },
    average:         { bg: "rgba(245,158,11,0.12)", color: "#fbbf24",  border: "rgba(245,158,11,0.3)" },
    underperforming: { bg: "rgba(239,68,68,0.12)",  color: "#f87171",  border: "rgba(239,68,68,0.3)"  },
  };
  const labels = { top: "Top Performer", average: "Average", underperforming: "Underperforming" };
  const s = styles[label] ?? styles.average;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {labels[label]}
    </span>
  );
}

function TrendArrow({ trend }) {
  if (trend === "up")   return <span className="text-emerald-400 text-sm">↑</span>;
  if (trend === "down") return <span className="text-red-400 text-sm">↓</span>;
  return <span className="text-sm" style={{ color: "var(--k-text-faint)" }}>→</span>;
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: "var(--k-tooltip-bg)", border: "1px solid var(--k-tooltip-border)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--k-text-muted)" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── ROAS Trend ────────────────────────────────────────────────────────────────

function RoasTrendSection({ campaigns, overview, startDate, endDate }) {
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [trendData, setTrendData]               = useState(null);
  const [trendLoading, setTrendLoading]         = useState(true);

  useEffect(() => {
    async function fetchTrend() {
      setTrendLoading(true);
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (selectedCampaign !== "all") params.set("campaign_name", selectedCampaign);
      try {
        const res = await fetch(`${API}/api/analytics/roas-trend?${params}`);
        setTrendData(await res.json());
      } catch { setTrendData(null); }
      finally  { setTrendLoading(false); }
    }
    fetchTrend();
  }, [selectedCampaign, startDate, endDate]);

  const rows           = trendData?.rows ?? [];
  const datesCollapsed = trendData?.dates_collapsed ?? false;

  const trendPivot = (() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.date]) map[r.date] = { date: r.date };
      map[r.date][r.campaign_name] = r.roas;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const trendCampaigns = [...new Set(rows.map((r) => r.campaign_name))];
  const fallbackData   = campaigns.map((c, i) => ({ name: shortName(c.campaign_name), ROAS: c.avg_roas, color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }));

  const gridColor = "var(--k-chart-grid)";
  const textColor = "var(--k-chart-text)";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardHeader
          title="ROAS Trend"
          subtitle={datesCollapsed
            ? "Showing avg ROAS per campaign — time-series not available"
            : `Daily avg ROAS · ${trendPivot.length} days · ${trendCampaigns.length} campaigns`}
        />
        {!datesCollapsed && (
          <select
            className="k-input px-3 py-1.5 text-xs focus:outline-none"
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => <option key={c.campaign_name} value={c.campaign_name}>{c.campaign_name}</option>)}
          </select>
        )}
      </div>

      {trendLoading ? <SkeletonBlock h="h-72" /> : (
        datesCollapsed || trendPivot.length <= 1 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="text-amber-500 text-xs">⚠</span>
              <p className="text-xs" style={{ color: "var(--k-text-muted)" }}>Date range data not available — showing overall performance</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={fallbackData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 10 }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                <Tooltip content={<ChartTooltip formatter={(v) => `${v?.toFixed(2)}x`} />} />
                <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Break-even 2x", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine y={overview?.avg_roas ?? 0} stroke="#6366f1" strokeDasharray="4 4" label={{ value: `Avg ${(overview?.avg_roas ?? 0).toFixed(2)}x`, fill: "#6366f1", fontSize: 10, position: "insideTopRight" }} />
                <Bar dataKey="ROAS" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendPivot} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}x`} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v?.toFixed(2)}x`} />} />
              <Legend wrapperStyle={{ fontSize: 10, color: textColor }} />
              <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "2x", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
              <ReferenceLine y={overview?.avg_roas ?? 0} stroke="#6366f1" strokeDasharray="4 4" label={{ value: `Avg ${(overview?.avg_roas ?? 0).toFixed(2)}x`, fill: "#6366f1", fontSize: 10, position: "insideTopRight" }} />
              {trendCampaigns.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]} dot={false} strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
      )}
    </Card>
  );
}

// ── Date range picker ─────────────────────────────────────────────────────────

function DateRangePicker({ startDate, endDate, onChange }) {
  return (
    <Card className="!space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs shrink-0" style={{ color: "var(--k-text-muted)" }}>From</label>
          <input
            type="date" value={startDate} min="2025-01-01" max={endDate}
            onChange={(e) => onChange(e.target.value, endDate)}
            className="k-input px-3 py-1.5 text-xs focus:outline-none"
          />
        </div>
        <span className="text-xs" style={{ color: "var(--k-text-faint)" }}>→</span>
        <div className="flex items-center gap-2">
          <label className="text-xs shrink-0" style={{ color: "var(--k-text-muted)" }}>To</label>
          <input
            type="date" value={endDate} min={startDate} max={todayYMD()}
            onChange={(e) => onChange(startDate, e.target.value)}
            className="k-input px-3 py-1.5 text-xs focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((range) => {
          const active = range.start() === startDate && range.end() === endDate;
          return (
            <button
              key={range.label}
              onClick={() => onChange(range.start(), range.end())}
              className="px-3 py-1 rounded-lg text-xs transition-all"
              style={active
                ? { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }
                : { background: "var(--k-bg2)", border: "1px solid var(--k-card-border)", color: "var(--k-text-muted)" }
              }
            >
              {range.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate]     = useState(todayYMD());
  const [overview, setOverview]   = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [sortKey, setSortKey]     = useState("avg_roas");
  const [sortAsc, setSortAsc]     = useState(false);

  function handleDateChange(s, e) { setStartDate(s); setEndDate(e); }

  useEffect(() => {
    async function fetchAll() {
      setLoading(true); setError(null);
      try {
        const params = `?start_date=${startDate}&end_date=${endDate}`;
        const [ov, camps] = await Promise.all([
          fetch(`${API}/api/analytics/overview${params}`).then((r) => r.json()),
          fetch(`${API}/api/analytics/campaigns${params}`).then((r) => r.json()),
        ]);
        setOverview(ov); setCampaigns(camps);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    fetchAll();
  }, [startDate, endDate]);

  const avgCtr = overview?.avg_ctr ?? 0;
  const spendRevData = campaigns.map((c) => ({ name: shortName(c.campaign_name), Spend: c.total_spend_inr, Revenue: c.total_revenue_inr }));
  const ctrData = campaigns.map((c) => ({ name: shortName(c.campaign_name), aboveAvg: c.avg_ctr >= avgCtr ? c.avg_ctr : 0, belowAvg: c.avg_ctr < avgCtr ? c.avg_ctr : 0 }));
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? av - bv : bv - av;
  });
  const top3    = [...campaigns].sort((a, b) => b.avg_roas - a.avg_roas).slice(0, 3);
  const bottom3 = [...campaigns].sort((a, b) => a.avg_roas - b.avg_roas).slice(0, 3);

  function toggleSort(key) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const gridColor = "var(--k-chart-grid)";
  const textColor = "var(--k-chart-text)";

  const SortTh = ({ k, label }) => (
    <th className="py-2 pr-4 text-left cursor-pointer select-none whitespace-nowrap transition-colors hover:opacity-80" onClick={() => toggleSort(k)}
        style={{ color: "var(--k-text-muted)" }}>
      {label} {sortKey === k ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  if (error) return (
    <div className="py-16 text-center space-y-2">
      <p className="font-semibold text-red-400">Failed to load analytics</p>
      <p className="text-sm" style={{ color: "var(--k-text-muted)" }}>{error}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--k-text)", letterSpacing: "-0.02em" }}>Analytics</h1>
        <p className="text-sm mt-1" style={{ color: "var(--k-text-muted)" }}>Campaign performance across all active and historical campaigns</p>
        {overview?.earliest_date && (
          <p className="text-xs mt-0.5" style={{ color: "var(--k-text-faint)" }}>
            Data: {overview.earliest_date} → {overview.latest_date}
            {overview.distinct_date_count <= 3 && (
              <span className="ml-2 text-amber-600">⚠ only {overview.distinct_date_count} distinct date(s)</span>
            )}
          </p>
        )}
      </div>

      {/* Date range picker */}
      <DateRangePicker startDate={startDate} endDate={endDate} onChange={handleDateChange} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) : (
          <>
            <KpiCard label="Total Spend"   value={inr(overview?.total_spend_inr)}   sub={`${(overview?.total_impressions ?? 0).toLocaleString("en-IN")} impressions`} />
            <KpiCard label="Total Revenue" value={inr(overview?.total_revenue_inr)} sub={`${(overview?.total_conversions ?? 0).toLocaleString("en-IN")} conversions`} />
            <KpiCard label="Avg ROAS"      value={roasFmt(overview?.avg_roas)}      sub="across all campaigns" />
            <KpiCard label="Avg CTR"       value={pct(overview?.avg_ctr)}           sub="click-through rate" />
          </>
        )}
      </div>

      {/* ROAS Trend */}
      {!loading ? <RoasTrendSection campaigns={campaigns} overview={overview} startDate={startDate} endDate={endDate} /> : <SkeletonBlock h="h-80" />}

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader title="Campaign Performance" subtitle="Click column headers to sort" />
        {loading ? <SkeletonBlock h="h-48" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs uppercase" style={{ borderBottom: "1px solid var(--k-divider)" }}>
                  <SortTh k="campaign_name"     label="Campaign"    />
                  <SortTh k="total_spend_inr"   label="Spend ₹"     />
                  <SortTh k="total_revenue_inr" label="Revenue ₹"   />
                  <SortTh k="avg_roas"          label="ROAS"        />
                  <SortTh k="avg_ctr"           label="CTR"         />
                  <SortTh k="total_conversions" label="Conversions" />
                  <th className="py-2 text-left" style={{ color: "var(--k-text-muted)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((c) => (
                  <tr key={c.campaign_name} className="transition-colors" style={{ borderBottom: "1px solid var(--k-divider)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--k-table-row)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <TrendArrow trend={c.roas_trend} />
                        <span className="font-medium text-xs" style={{ color: "var(--k-text)" }}>{c.campaign_name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs tabular-nums" style={{ color: "var(--k-text-muted)" }}>{inr(c.total_spend_inr)}</td>
                    <td className="py-3 pr-4 text-xs font-medium tabular-nums text-emerald-400">{inr(c.total_revenue_inr)}</td>
                    <td className="py-3 pr-4 text-xs font-semibold tabular-nums" style={{ color: "var(--k-text)" }}>{roasFmt(c.avg_roas)}</td>
                    <td className="py-3 pr-4 text-xs tabular-nums" style={{ color: "var(--k-text-muted)" }}>{pct(c.avg_ctr)}</td>
                    <td className="py-3 pr-4 text-xs tabular-nums" style={{ color: "var(--k-text-muted)" }}>{c.total_conversions.toLocaleString("en-IN")}</td>
                    <td className="py-3"><StatusBadge label={c.performance_label} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Spend vs Revenue */}
      <Card>
        <CardHeader title="Spend vs Revenue" subtitle="Per campaign total" />
        {loading ? <SkeletonBlock h="h-64" /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={spendRevData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 10 }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip formatter={inr} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: textColor, paddingTop: 8 }} />
              <Bar dataKey="Spend"   fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Top vs Bottom Performers */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <h2 className="text-sm font-semibold text-emerald-400">Top 3 Performers</h2>
            {top3.map((c) => (
              <div key={c.campaign_name} className="rounded-lg p-3 space-y-1" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate" style={{ color: "var(--k-text)" }}>{c.campaign_name}</span>
                  <span className="text-emerald-300 text-sm font-bold shrink-0">{roasFmt(c.avg_roas)}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: "var(--k-text-faint)" }}>
                  <span>Spend <span style={{ color: "var(--k-text-muted)" }}>{inr(c.total_spend_inr)}</span></span>
                  <span>Revenue <span className="text-emerald-300">{inr(c.total_revenue_inr)}</span></span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <h2 className="text-sm font-semibold text-red-400">Bottom 3 — Needs Attention</h2>
            {bottom3.map((c) => (
              <div key={c.campaign_name} className="rounded-lg p-3 space-y-1" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate" style={{ color: "var(--k-text)" }}>{c.campaign_name}</span>
                  <span className="text-red-300 text-sm font-bold shrink-0">{roasFmt(c.avg_roas)}</span>
                </div>
                <div className="flex gap-4 text-xs" style={{ color: "var(--k-text-faint)" }}>
                  <span>Spend <span style={{ color: "var(--k-text-muted)" }}>{inr(c.total_spend_inr)}</span></span>
                  <span>Revenue <span className="text-red-300">{inr(c.total_revenue_inr)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTR Comparison */}
      <Card>
        <CardHeader title="CTR Comparison" subtitle={`Green = above account average (${pct(avgCtr)}), Red = below`} />
        {loading ? <SkeletonBlock h="h-64" /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ctrData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 10 }} tickLine={false} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: textColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const ctrVal = (payload[0]?.value || 0) + (payload[1]?.value || 0);
                return (
                  <div className="rounded-lg p-3 text-xs" style={{ background: "var(--k-tooltip-bg)", border: "1px solid var(--k-tooltip-border)" }}>
                    <p style={{ color: "var(--k-text-muted)" }}>{label}</p>
                    <p style={{ color: "var(--k-text)" }}>CTR: {ctrVal.toFixed(2)}%</p>
                  </div>
                );
              }} />
              <ReferenceLine y={avgCtr} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Avg ${pct(avgCtr)}`, fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }} />
              <Bar dataKey="aboveAvg" name="Above Avg" stackId="ctr" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="belowAvg" name="Below Avg" stackId="ctr" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
