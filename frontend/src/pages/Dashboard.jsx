// Kampaign.ai — Dashboard page
import { useCallback, useEffect, useState } from "react";
import MetricCard from "../components/MetricCard";
import CampaignTable from "../components/CampaignTable";
import InsightCard from "../components/InsightCard";
import ActionCard from "../components/ActionCard";
import ChatPanel from "../components/ChatPanel";
import { ToastContainer, useToasts } from "../components/Toast";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function Dashboard() {
  const [campaigns, setCampaigns]         = useState([]);
  const [chatCampaigns, setChatCampaigns] = useState([]);
  const [insights, setInsights]           = useState([]);
  const [latestActions, setLatestActions] = useState([]);
  const [generatedAt, setGeneratedAt]     = useState(null);
  const [stats, setStats]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [historyOpen, setHistoryOpen]     = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);
  const [showDrafts, setShowDrafts]       = useState(false);

  const { toasts, addToast, removeToast } = useToasts();

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/campaigns/`).then((r) => r.json()),
      fetch(`${API}/api/insights/`).then((r) => r.json()),
      fetch(`${API}/api/insights/latest`).then((r) => r.json()),
      fetch(`${API}/api/dashboard/stats`).then((r) => r.json()),
      fetch(`${API}/api/chat/campaigns`).then((r) => r.json()),
    ])
      .then(([c, i, latest, s, cc]) => {
        setCampaigns(c);
        setChatCampaigns(cc);
        setInsights(i);
        setLatestActions(latest.actions ?? []);
        setGeneratedAt(latest.generated_at ?? null);
        setStats(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const removeAction = useCallback((action) => {
    setLatestActions((prev) =>
      prev.filter((a) => !(a.action_type === action.action_type && a.campaign_name === action.campaign_name))
    );
  }, []);

  const deleteCampaign = useCallback(async (id, name) => {
    if (!window.confirm(`Delete "${name}" from Kampaign.ai?\n\n(This will NOT delete it from Facebook)`)) return;
    try {
      await fetch(`${API}/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      addToast(`Deleted "${name}" from Kampaign.ai`, "info");
    } catch (err) {
      addToast(`Delete failed: ${err.message}`, "error");
    }
  }, [addToast]);

  const kpis = [
    { label: "Active Campaigns",   value: stats?.active_campaigns   ?? campaigns.filter((c) => c.status === "active").length },
    { label: "Total Campaigns",    value: stats?.total_campaigns    ?? campaigns.length },
    { label: "Open Insights",      value: stats?.open_insights      ?? insights.filter((i) => !i.acknowledged).length },
    { label: "AI Recommendations", value: stats?.ai_recommendations ?? latestActions.length },
  ];

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  const latestInsight = insights[0] ?? null;
  const olderInsights = insights.slice(1);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--k-text)", letterSpacing: "-0.02em" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--k-text-muted)" }}>
          Campaign overview · Glowra Skincare
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
          Failed to load data: {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <MetricCard key={k.label} label={k.label} value={String(k.value)} colorIndex={i} />
        ))}
      </div>

      {/* Two-column layout: left 60% | right 40% */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: AI Recommendations */}
        <section className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--k-text)" }}>
                AI Recommendations
              </h2>
              {formattedDate && (
                <p className="text-xs mt-0.5" style={{ color: "var(--k-text-muted)" }}>
                  Generated {formattedDate}
                </p>
              )}
            </div>
            {latestActions.length > 0 && (
              <span className="text-xs" style={{ color: "var(--k-text-muted)" }}>
                {latestActions.length} pending
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl h-24 animate-pulse" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }} />
              ))}
            </div>
          ) : latestActions.length === 0 ? (
            <div className="rounded-xl px-4 py-8 text-center" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}>
              <p className="text-sm" style={{ color: "var(--k-text-muted)" }}>
                No pending recommendations.{" "}
                <button
                  onClick={async () => {
                    try {
                      addToast("Generating AI recommendations…", "info", 8000);
                      const res = await fetch(`${API}/api/insights/generate`, { method: "POST" });
                      const data = await res.json();
                      setLatestActions(data.actions ?? []);
                      setGeneratedAt(data.generated_at);
                      addToast(`Generated ${(data.actions ?? []).length} recommendations`, "success");
                    } catch (err) {
                      addToast(`Generation failed: ${err.message}`, "error");
                    }
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline transition"
                >
                  Generate now
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {latestActions.map((action, idx) => (
                <ActionCard
                  key={`${action.action_type}-${action.campaign_name}-${idx}`}
                  action={action}
                  addToast={addToast}
                  onExecuted={removeAction}
                  onDismissed={removeAction}
                />
              ))}
            </div>
          )}
        </section>

        {/* Right: AI Insights */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--k-text)" }}>AI Insights</h2>

          {loading ? (
            <div className="rounded-xl h-48 animate-pulse" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }} />
          ) : !latestInsight ? (
            <p className="text-sm" style={{ color: "var(--k-text-muted)" }}>
              No insights yet — generate recommendations to get started.
            </p>
          ) : (
            <div className="space-y-3">
              <InsightCard insight={latestInsight} isLatest />

              {olderInsights.length > 0 && (
                <div>
                  <button
                    onClick={() => setHistoryOpen((o) => !o)}
                    className="flex items-center gap-2 text-sm transition mt-1"
                    style={{ color: "var(--k-text-muted)" }}
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${historyOpen ? "rotate-90" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0L14.414 10l-5.707 5.707a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Previous Insights ({olderInsights.length})
                  </button>
                  {historyOpen && (
                    <div className="mt-3 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {olderInsights.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Campaigns table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: "var(--k-text)" }}>Campaigns</h2>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "var(--k-text-muted)" }}>
            <input
              type="checkbox"
              checked={showDrafts}
              onChange={(e) => setShowDrafts(e.target.checked)}
              className="accent-indigo-500"
            />
            Show drafts
          </label>
        </div>
        {loading ? (
          <div className="rounded-xl h-32 animate-pulse" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }} />
        ) : (
          <CampaignTable
            campaigns={(() => {
              // FIX 2 — always strip failed test campaigns (draft + never reached Facebook)
              const real = campaigns.filter((c) => !(c.status === "draft" && !c.meta_campaign_id));
              return showDrafts ? real : real.filter((c) => c.status !== "draft");
            })()}
            onDelete={deleteCampaign}
          />
        )}
      </section>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Floating chat button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        title="Ask Kampaign.ai"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2" style={{ borderColor: "var(--k-bg)" }} />
      </button>

      {chatOpen && <ChatPanel campaigns={chatCampaigns} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
