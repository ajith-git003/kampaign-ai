// Kampaign.ai — AI-native campaign engine — AI Strategy Builder page
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const OBJECTIVES = ["Purchases", "Leads", "Awareness", "App Installs"];

const STAGE_STYLES = {
  TOF: { badge: "bg-blue-900/60 text-blue-300 border-blue-700/40",   border: "border-t-blue-500",  label: "Top of Funnel"    },
  MOF: { badge: "bg-yellow-900/60 text-yellow-300 border-yellow-700/40", border: "border-t-yellow-500", label: "Middle of Funnel" },
  BOF: { badge: "bg-green-900/60 text-green-300 border-green-700/40",  border: "border-t-green-500",  label: "Bottom of Funnel" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (n) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const pct = (n) =>
  typeof n === "number" ? `${n.toFixed(1)}%` : "—";

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-[#1e2235] border border-gray-700/50 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function FunnelColumn({ stage }) {
  const s = STAGE_STYLES[stage.stage] ?? STAGE_STYLES.TOF;
  return (
    <div className={`bg-[#141622] border border-gray-700/40 border-t-2 ${s.border} rounded-lg p-4 space-y-3 flex-1 min-w-0`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${s.badge}`}>
          {stage.stage}
        </span>
        <span className="text-xs text-gray-400">{stage.name}</span>
      </div>

      <p className="text-sm font-medium text-white leading-tight">{stage.campaign_name_suggestion}</p>

      <div className="space-y-1.5 text-xs text-gray-400">
        <p><span className="text-gray-600">Audience</span> {stage.audience_description}</p>
        <p><span className="text-gray-600">Format</span> {stage.ad_format}</p>
        <p>
          <span className="text-gray-600">Budget</span>{" "}
          <span className="text-white font-medium">{inr(stage.budget_inr)}/mo</span>
          <span className="text-gray-600 ml-1">({stage.budget_pct}%)</span>
        </p>
        <p>
          <span className="text-gray-600">Est. ROAS</span>{" "}
          <span className="text-green-300 font-medium">{stage.kpis?.expected_roas?.toFixed(1)}x</span>
        </p>
      </div>

      {stage.creative_guidance && (
        <div className="border-t border-gray-700/40 pt-2">
          <p className="text-xs text-gray-500 italic leading-relaxed">{stage.creative_guidance}</p>
        </div>
      )}
    </div>
  );
}

function ProjectionColumn({ label, data, isLast }) {
  return (
    <div className={`flex-1 space-y-2 ${isLast ? "" : "border-r border-gray-700/40 pr-4"}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Spend</span>
          <span className="text-gray-200">{inr(data?.spend_inr)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Clicks</span>
          <span className="text-gray-200">{data?.estimated_clicks?.toLocaleString("en-IN") ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Purchases</span>
          <span className="text-gray-200">{data?.estimated_purchases?.toLocaleString("en-IN") ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Revenue</span>
          <span className="text-green-300 font-semibold">{inr(data?.estimated_revenue_inr)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-700/40 pt-1.5">
          <span className="text-gray-500">ROAS</span>
          <span className="text-green-300 font-semibold">{data?.estimated_roas?.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
}

// ── Loading dots animation ────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-gray-400 text-sm">Kampaign.ai is building your strategy…</p>
      <p className="text-gray-600 text-xs">This usually takes 10–15 seconds</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Strategy() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    niche: "",
    product_name: "",
    product_price_inr: "",
    objective: "Purchases",
    monthly_budget_inr: "",
    target_audience_description: "",
  });
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStrategy(null);
    try {
      const res = await fetch(`${API}/api/strategy/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          product_price_inr:  Number(form.product_price_inr),
          monthly_budget_inr: Number(form.monthly_budget_inr),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? `API error ${res.status}`);
      }
      setStrategy(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Strategy Builder</h1>
        <p className="text-gray-400 text-sm mt-1">
          Get a complete Facebook ads strategy in seconds — powered by GPT-4o-mini
        </p>
      </div>

      {/* Input form */}
      {!strategy && !loading && (
        <div className="bg-[#1e2235] border border-gray-700/50 rounded-xl p-6">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Niche</label>
                <input
                  className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                             placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  value={form.niche}
                  onChange={(e) => set("niche", e.target.value)}
                  placeholder="e.g. DTC Skincare, Fitness, EdTech"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Product Name</label>
                <input
                  className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                             placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  value={form.product_name}
                  onChange={(e) => set("product_name", e.target.value)}
                  placeholder="e.g. Anti-aging serum"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Product Price (₹)</label>
                <input
                  type="number" min="1"
                  className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                             placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  value={form.product_price_inr}
                  onChange={(e) => set("product_price_inr", e.target.value)}
                  placeholder="e.g. 999"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Monthly Budget (₹)</label>
                <input
                  type="number" min="1000"
                  className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                             placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  value={form.monthly_budget_inr}
                  onChange={(e) => set("monthly_budget_inr", e.target.value)}
                  placeholder="e.g. 50000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Objective</label>
                <select
                  className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                             focus:outline-none focus:border-indigo-500"
                  value={form.objective}
                  onChange={(e) => set("objective", e.target.value)}
                >
                  {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Target Audience</label>
              <textarea
                rows={2}
                className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                           placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
                value={form.target_audience_description}
                onChange={(e) => set("target_audience_description", e.target.value)}
                placeholder="e.g. Women aged 25-40 in Tier 1 cities, interested in skincare and beauty"
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                         py-2.5 rounded-lg transition-colors text-sm"
            >
              Generate Strategy
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingDots />}

      {/* Strategy output */}
      {strategy && (
        <div className="space-y-5">
          {/* Reset button */}
          <button
            onClick={() => setStrategy(null)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Generate new strategy
          </button>

          {/* Card 1 — Summary */}
          <SectionCard
            title="Strategy Summary"
            subtitle={`Generated for: ${form.niche} — ${form.product_name}`}
          >
            <p className="text-sm text-gray-300 leading-relaxed">{strategy.summary}</p>
            <div className="flex gap-4 text-xs text-gray-500 pt-1">
              <span>Budget: <span className="text-white">{inr(Number(form.monthly_budget_inr))}/mo</span></span>
              <span>Price: <span className="text-white">{inr(Number(form.product_price_inr))}</span></span>
              <span>Objective: <span className="text-white">{form.objective}</span></span>
            </div>
          </SectionCard>

          {/* Card 2 — Funnel Map */}
          <SectionCard title="Funnel Map" subtitle="Budget allocation across campaign stages">
            <div className="flex gap-3 flex-col sm:flex-row">
              {strategy.funnel_stages?.map((stage) => (
                <FunnelColumn key={stage.stage} stage={stage} />
              ))}
            </div>
          </SectionCard>

          {/* Card 3 — KPI Benchmarks */}
          <SectionCard title="KPI Benchmarks" subtitle="Expected performance by funnel stage">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 border-b border-gray-700">
                    <th className="py-2 pr-4">Stage</th>
                    <th className="py-2 pr-4">CPM</th>
                    <th className="py-2 pr-4">CPC</th>
                    <th className="py-2 pr-4">CTR</th>
                    <th className="py-2">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.funnel_stages?.map((stage) => {
                    const s = STAGE_STYLES[stage.stage] ?? STAGE_STYLES.TOF;
                    return (
                      <tr key={stage.stage} className="border-b border-gray-800">
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.badge}`}>
                            {stage.stage}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-gray-300">{inr(stage.kpis?.expected_cpm_inr)}</td>
                        <td className="py-2.5 pr-4 text-gray-300">{inr(stage.kpis?.expected_cpc_inr)}</td>
                        <td className="py-2.5 pr-4 text-gray-300">{pct(stage.kpis?.expected_ctr_pct)}</td>
                        <td className="py-2.5 text-green-300 font-medium">{stage.kpis?.expected_roas?.toFixed(1)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {strategy.funnel_metrics && (
              <div className="flex gap-6 pt-2 text-xs text-gray-500 border-t border-gray-700/40">
                <span>LP → Cart: <span className="text-gray-300">{pct(strategy.funnel_metrics.landing_page_to_cart_pct)}</span></span>
                <span>Cart → Purchase: <span className="text-gray-300">{pct(strategy.funnel_metrics.cart_to_purchase_pct)}</span></span>
                <span>Overall CVR: <span className="text-gray-300">{pct(strategy.funnel_metrics.overall_conversion_rate)}</span></span>
              </div>
            )}
          </SectionCard>

          {/* Card 4 — 90-Day Projections */}
          <SectionCard title="90-Day Revenue Projection" subtitle="Estimated performance ramp-up">
            <div className="flex gap-4">
              {["month_1", "month_2", "month_3"].map((key, i) => (
                <ProjectionColumn
                  key={key}
                  label={`Month ${i + 1}`}
                  data={strategy.projections?.[key]}
                  isLast={i === 2}
                />
              ))}
            </div>
          </SectionCard>

          {/* Card 5 — Tools Required */}
          <SectionCard title="Tools Required" subtitle="Set these up before launch">
            <div className="space-y-2">
              {strategy.tools_required?.map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-4 h-4 mt-0.5 rounded border border-gray-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{t.tool}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                        t.free ? "bg-green-900/50 text-green-400" : "bg-gray-700 text-gray-400"
                      }`}>
                        {t.free ? "FREE" : "PAID"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{t.purpose}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Card 6 — Launch Checklist */}
          <SectionCard title="Launch Checklist" subtitle="Complete these steps before going live">
            <div className="space-y-2">
              {strategy.launch_checklist?.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-0.5 rounded border border-gray-600 flex items-center justify-center shrink-0 text-xs text-gray-600 font-mono">
                    {i + 1}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* CTA */}
          <button
            onClick={() => navigate("/launch")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold
                       py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            Launch These Campaigns →
          </button>
        </div>
      )}
    </div>
  );
}
