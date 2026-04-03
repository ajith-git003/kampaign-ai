// Kampaign.ai — AI Strategy Builder page
import { useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const OBJECTIVES = ["Purchases", "Leads", "Awareness", "App Installs"];

const STAGE_STYLES = {
  TOF: { badgeBg: "rgba(99,102,241,0.15)",  badgeColor: "#a5b4fc", topBorder: "#6366f1", label: "Top of Funnel"    },
  MOF: { badgeBg: "rgba(245,158,11,0.15)",  badgeColor: "#fbbf24", topBorder: "#f59e0b", label: "Middle of Funnel" },
  BOF: { badgeBg: "rgba(16,185,129,0.15)",  badgeColor: "#34d399", topBorder: "#10b981", label: "Bottom of Funnel" },
};

const inr = (n) => typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";
const pct = (n) => typeof n === "number" ? `${n.toFixed(1)}%` : "—";

// ── Shared card ───────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}>
      {(title || subtitle) && (
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--k-text)" }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--k-text-muted)" }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Form input helpers ────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--k-text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "k-input w-full px-3 py-2 text-sm focus:outline-none";

// ── Funnel column ─────────────────────────────────────────────────────────────

function FunnelColumn({ stage }) {
  const s = STAGE_STYLES[stage.stage] ?? STAGE_STYLES.TOF;
  return (
    <div
      className="rounded-xl p-4 space-y-3 flex-1 min-w-0"
      style={{
        background: "var(--k-bg2)",
        border: "1px solid var(--k-card-border)",
        borderTop: `2px solid ${s.topBorder}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: s.badgeBg, color: s.badgeColor }}>
          {stage.stage}
        </span>
        <span className="text-xs" style={{ color: "var(--k-text-muted)" }}>{stage.name}</span>
      </div>

      <p className="text-sm font-medium leading-tight" style={{ color: "var(--k-text)" }}>{stage.campaign_name_suggestion}</p>

      <div className="space-y-1.5 text-xs" style={{ color: "var(--k-text-muted)" }}>
        <p><span style={{ color: "var(--k-text-faint)" }}>Audience</span> {stage.audience_description}</p>
        <p><span style={{ color: "var(--k-text-faint)" }}>Format</span> {stage.ad_format}</p>
        <p>
          <span style={{ color: "var(--k-text-faint)" }}>Budget</span>{" "}
          <span className="font-medium" style={{ color: "var(--k-text)" }}>{inr(stage.budget_inr)}/mo</span>
          <span style={{ color: "var(--k-text-faint)" }} className="ml-1">({stage.budget_pct}%)</span>
        </p>
        <p>
          <span style={{ color: "var(--k-text-faint)" }}>Est. ROAS</span>{" "}
          <span className="font-medium text-emerald-400">{stage.kpis?.expected_roas?.toFixed(1)}x</span>
        </p>
      </div>

      {stage.creative_guidance && (
        <div className="pt-2" style={{ borderTop: "1px solid var(--k-divider)" }}>
          <p className="text-xs italic leading-relaxed" style={{ color: "var(--k-text-faint)" }}>{stage.creative_guidance}</p>
        </div>
      )}
    </div>
  );
}

function ProjectionColumn({ label, data, isLast }) {
  return (
    <div className={`flex-1 space-y-2 ${isLast ? "" : "pr-4"}`} style={isLast ? {} : { borderRight: "1px solid var(--k-divider)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--k-text-muted)" }}>{label}</p>
      <div className="space-y-1.5 text-sm">
        {[
          ["Spend",     inr(data?.spend_inr),                                  "var(--k-text-muted)"],
          ["Clicks",    data?.estimated_clicks?.toLocaleString("en-IN") ?? "—","var(--k-text-muted)"],
          ["Purchases", data?.estimated_purchases?.toLocaleString("en-IN") ?? "—","var(--k-text-muted)"],
          ["Revenue",   inr(data?.estimated_revenue_inr),                      "#34d399"],
          ["ROAS",      `${data?.estimated_roas?.toFixed(1)}x`,               "#34d399"],
        ].map(([k, v, color], i) => (
          <div key={k} className={`flex justify-between ${i === 4 ? "pt-1.5" : ""}`} style={i === 4 ? { borderTop: "1px solid var(--k-divider)" } : {}}>
            <span style={{ color: "var(--k-text-faint)" }}>{k}</span>
            <span style={{ color }} className={i >= 3 ? "font-semibold" : ""}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <p className="text-sm" style={{ color: "var(--k-text-muted)" }}>Kampaign.ai is building your strategy…</p>
      <p className="text-xs" style={{ color: "var(--k-text-faint)" }}>This usually takes 10–15 seconds</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Strategy() {
  const [form, setForm] = useState({
    niche: "", product_name: "", product_price_inr: "",
    objective: "Purchases", monthly_budget_inr: "", target_audience_description: "",
  });
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true); setError(null); setStrategy(null);
    try {
      const res = await fetch(`${API}/api/strategy/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, product_price_inr: Number(form.product_price_inr), monthly_budget_inr: Number(form.monthly_budget_inr) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? `API error ${res.status}`); }
      setStrategy(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--k-text)", letterSpacing: "-0.02em" }}>AI Strategy Builder</h1>
        <p className="text-sm mt-1" style={{ color: "var(--k-text-muted)" }}>Get a complete Facebook ads strategy in seconds</p>
      </div>

      {/* Input form */}
      {!strategy && !loading && (
        <Card>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Niche">
                <input className={inputCls} value={form.niche} onChange={(e) => set("niche", e.target.value)} placeholder="e.g. DTC Skincare, Fitness, EdTech" required />
              </Field>
              <Field label="Product Name">
                <input className={inputCls} value={form.product_name} onChange={(e) => set("product_name", e.target.value)} placeholder="e.g. Anti-aging serum" required />
              </Field>
              <Field label="Product Price (₹)">
                <input type="number" min="1" className={inputCls} value={form.product_price_inr} onChange={(e) => set("product_price_inr", e.target.value)} placeholder="e.g. 999" required />
              </Field>
              <Field label="Monthly Budget (₹)">
                <input type="number" min="1000" className={inputCls} value={form.monthly_budget_inr} onChange={(e) => set("monthly_budget_inr", e.target.value)} placeholder="e.g. 50000" required />
              </Field>
              <Field label="Objective">
                <select className={inputCls} value={form.objective} onChange={(e) => set("objective", e.target.value)}>
                  {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Target Audience">
              <textarea
                rows={2}
                className={`${inputCls} resize-none`}
                value={form.target_audience_description}
                onChange={(e) => set("target_audience_description", e.target.value)}
                placeholder="e.g. Women aged 25-40 in Tier 1 cities, interested in skincare and beauty"
                required
              />
            </Field>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" className="k-btn w-full py-2.5 text-sm">Generate Strategy</button>
          </form>
        </Card>
      )}

      {loading && <LoadingDots />}

      {/* Strategy output */}
      {strategy && (
        <div className="space-y-5">
          <button onClick={() => setStrategy(null)} className="text-xs transition" style={{ color: "var(--k-text-faint)" }}>
            ← Generate new strategy
          </button>

          {/* Summary */}
          <Card title="Strategy Summary" subtitle={`Generated for: ${form.niche} — ${form.product_name}`}>
            <p className="text-sm leading-relaxed" style={{ color: "var(--k-text-muted)" }}>{strategy.summary}</p>
            <div className="flex gap-4 text-xs pt-1" style={{ color: "var(--k-text-faint)" }}>
              <span>Budget: <span style={{ color: "var(--k-text)" }}>{inr(Number(form.monthly_budget_inr))}/mo</span></span>
              <span>Price: <span style={{ color: "var(--k-text)" }}>{inr(Number(form.product_price_inr))}</span></span>
              <span>Objective: <span style={{ color: "var(--k-text)" }}>{form.objective}</span></span>
            </div>
          </Card>

          {/* Funnel Map */}
          <Card title="Funnel Map" subtitle="Budget allocation across campaign stages">
            <div className="flex gap-3 flex-col sm:flex-row">
              {strategy.funnel_stages?.map((stage) => <FunnelColumn key={stage.stage} stage={stage} />)}
            </div>
          </Card>

          {/* KPI Benchmarks */}
          <Card title="KPI Benchmarks" subtitle="Expected performance by funnel stage">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-xs uppercase" style={{ borderBottom: "1px solid var(--k-divider)", color: "var(--k-text-muted)" }}>
                    {["Stage", "CPM", "CPC", "CTR", "ROAS"].map((h) => (
                      <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {strategy.funnel_stages?.map((stage) => {
                    const s = STAGE_STYLES[stage.stage] ?? STAGE_STYLES.TOF;
                    return (
                      <tr key={stage.stage} style={{ borderBottom: "1px solid var(--k-divider)" }}>
                        <td className="py-2.5 pr-4">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.badgeBg, color: s.badgeColor }}>{stage.stage}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-xs" style={{ color: "var(--k-text-muted)" }}>{inr(stage.kpis?.expected_cpm_inr)}</td>
                        <td className="py-2.5 pr-4 text-xs" style={{ color: "var(--k-text-muted)" }}>{inr(stage.kpis?.expected_cpc_inr)}</td>
                        <td className="py-2.5 pr-4 text-xs" style={{ color: "var(--k-text-muted)" }}>{pct(stage.kpis?.expected_ctr_pct)}</td>
                        <td className="py-2.5 text-xs font-medium text-emerald-400">{stage.kpis?.expected_roas?.toFixed(1)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {strategy.funnel_metrics && (
              <div className="flex gap-6 pt-2 text-xs" style={{ borderTop: "1px solid var(--k-divider)", color: "var(--k-text-faint)" }}>
                <span>LP → Cart: <span style={{ color: "var(--k-text-muted)" }}>{pct(strategy.funnel_metrics.landing_page_to_cart_pct)}</span></span>
                <span>Cart → Purchase: <span style={{ color: "var(--k-text-muted)" }}>{pct(strategy.funnel_metrics.cart_to_purchase_pct)}</span></span>
                <span>Overall CVR: <span style={{ color: "var(--k-text-muted)" }}>{pct(strategy.funnel_metrics.overall_conversion_rate)}</span></span>
              </div>
            )}
          </Card>

          {/* 90-Day Projections */}
          <Card title="90-Day Revenue Projection" subtitle="Estimated performance ramp-up">
            <div className="flex gap-4">
              {["month_1", "month_2", "month_3"].map((key, i) => (
                <ProjectionColumn key={key} label={`Month ${i + 1}`} data={strategy.projections?.[key]} isLast={i === 2} />
              ))}
            </div>
          </Card>

          {/* Tools Required */}
          <Card title="Tools Required" subtitle="Set these up before launch">
            <div className="space-y-2">
              {strategy.tools_required?.map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-0.5 rounded shrink-0" style={{ border: "1px solid var(--k-card-border)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--k-text)" }}>{t.tool}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${t.free ? "text-emerald-400" : "text-gray-400"}`}
                            style={{ background: t.free ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)" }}>
                        {t.free ? "FREE" : "PAID"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--k-text-faint)" }}>{t.purpose}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Launch Checklist */}
          <Card title="Launch Checklist" subtitle="Complete these steps before going live">
            <div className="space-y-2">
              {strategy.launch_checklist?.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5 rounded flex items-center justify-center shrink-0 text-xs font-mono"
                       style={{ border: "1px solid var(--k-card-border)", color: "var(--k-text-faint)" }}>
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--k-text-muted)" }}>{item}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* CTA */}
          <a
            href="https://adsmanager.facebook.com"
            target="_blank"
            rel="noreferrer"
            className="k-btn w-full py-3 text-sm flex items-center justify-center gap-2 rounded-xl"
          >
            Open Facebook Ads Manager →
          </a>
        </div>
      )}
    </div>
  );
}
