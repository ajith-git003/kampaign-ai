// Kampaign.ai — AI-native campaign engine — Dashboard page
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
  const [insights, setInsights]           = useState([]);
  const [latestActions, setLatestActions] = useState([]);
  const [generatedAt, setGeneratedAt]     = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [historyOpen, setHistoryOpen]     = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);

  const { toasts, addToast, removeToast } = useToasts();

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/campaigns/`).then((r) => r.json()),
      fetch(`${API}/api/insights/`).then((r) => r.json()),
      fetch(`${API}/api/insights/latest`).then((r) => r.json()),
    ])
      .then(([c, i, latest]) => {
        setCampaigns(c);
        setInsights(i);
        setLatestActions(latest.actions ?? []);
        setGeneratedAt(latest.generated_at ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const removeAction = useCallback((action) => {
    setLatestActions((prev) =>
      prev.filter(
        (a) =>
          !(a.action_type === action.action_type &&
            a.campaign_name === action.campaign_name)
      )
    );
  }, []);

  // FIX 4 — delete campaign
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
    { label: "Active Campaigns",   value: campaigns.filter((c) => c.status === "active").length },
    { label: "Total Campaigns",    value: campaigns.length },
    { label: "Open Insights",      value: insights.filter((i) => !i.acknowledged).length },
    { label: "AI Recommendations", value: latestActions.length },
  ];

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  // FIX 3 — split insights: latest vs history
  const latestInsight  = insights[0] ?? null;
  const olderInsights  = insights.slice(1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Kampaign.ai — AI-native campaign engine</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          Failed to load data: {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <MetricCard key={k.label} label={k.label} value={String(k.value)} />
        ))}
      </div>

      {/* AI Recommendations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">AI Recommendations</h2>
            {formattedDate && (
              <p className="text-xs text-gray-500 mt-0.5">Generated {formattedDate}</p>
            )}
          </div>
          {latestActions.length > 0 && (
            <span className="text-xs text-gray-500">
              {latestActions.length} pending action{latestActions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : latestActions.length === 0 ? (
          <div className="bg-[#1e2235] rounded-lg px-4 py-6 text-center">
            <p className="text-gray-500 text-sm">
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

      {/* Campaigns table — FIX 4 delete + FIX 5 ₹ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Campaigns</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : (
          <CampaignTable campaigns={campaigns} onDelete={deleteCampaign} />
        )}
      </section>

      {/* AI Insights — FIX 3: latest expanded, older collapsed */}
      <section>
        <h2 className="text-lg font-semibold mb-3">AI Insights</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : !latestInsight ? (
          <p className="text-gray-500 text-sm">
            No insights yet — generate recommendations to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Latest insight — always expanded */}
            <InsightCard insight={latestInsight} />

            {/* Older insights — collapsible */}
            {olderInsights.length > 0 && (
              <div>
                <button
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition mt-1"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${historyOpen ? "rotate-90" : ""}`}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0L14.414 10l-5.707 5.707a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Previous Insights ({olderInsights.length})
                </button>

                {historyOpen && (
                  <div className="mt-3 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {olderInsights.map((ins) => (
                      <InsightCard key={ins.id} insight={ins} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Floating chat button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-indigo-600
                   hover:bg-indigo-500 shadow-lg flex items-center justify-center
                   transition-colors group"
        title="Ask Kampaign.ai"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#13151f]" />
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <ChatPanel
          campaigns={campaigns}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
