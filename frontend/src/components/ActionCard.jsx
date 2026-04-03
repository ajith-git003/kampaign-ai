// Kampaign.ai — ActionCard component
import { useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TYPE_STYLES = {
  pause_campaign:    { border: "#ef4444", badgeBg: "rgba(239,68,68,0.12)",    badgeColor: "#f87171",  label: "Pause"          },
  increase_budget:   { border: "#10b981", badgeBg: "rgba(16,185,129,0.12)",   badgeColor: "#34d399",  label: "Increase Budget" },
  reduce_budget:     { border: "#f97316", badgeBg: "rgba(249,115,22,0.12)",   badgeColor: "#fb923c",  label: "Reduce Budget"   },
  launch_campaign:   { border: "#6366f1", badgeBg: "rgba(99,102,241,0.12)",   badgeColor: "#a5b4fc",  label: "Launch"          },
  activate_campaign: { border: "#f59e0b", badgeBg: "rgba(245,158,11,0.12)",   badgeColor: "#fbbf24",  label: "Activate"        },
};

const PRIORITY_COLORS = { high: "#f87171", medium: "#fbbf24", low: "var(--k-text-muted)" };
const DEFAULT_STYLE = { border: "var(--k-text-faint)", badgeBg: "rgba(107,114,128,0.12)", badgeColor: "var(--k-text-muted)", label: "Action" };

function ExecuteResultPanel({ result, onClose, onPauseFallback }) {
  if (result.loading) {
    return (
      <div
        className="mt-3 flex items-center gap-2 text-sm px-4 py-3 rounded-lg"
        style={{ background: "var(--k-bg2)", border: "1px solid var(--k-card-border)", color: "var(--k-text-muted)" }}
      >
        <svg className="w-4 h-4 animate-spin shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Executing on Facebook…
      </div>
    );
  }

  if (result.error === "minimum_budget") {
    return (
      <div className="mt-3 rounded-lg px-4 py-3 text-sm space-y-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
        <p className="text-amber-400 font-semibold">⚠️ Cannot Reduce Budget</p>
        <div className="space-y-1" style={{ color: "var(--k-text-muted)" }}>
          <div className="flex gap-2"><span className="w-36 shrink-0">Current budget</span><span>₹{result.current_budget_inr?.toLocaleString("en-IN")}/day</span></div>
          <div className="flex gap-2"><span className="w-36 shrink-0">Minimum allowed</span><span>₹{result.minimum_budget_inr?.toLocaleString("en-IN")}/day</span></div>
        </div>
        <p className="text-xs text-amber-400/70">Facebook requires at least ₹{result.minimum_budget_inr?.toLocaleString("en-IN")}/day. Consider pausing instead.</p>
        <div className="flex gap-2 pt-1">
          <button onClick={() => onPauseFallback(result.campaign_name)} className="px-3 py-1.5 text-xs font-semibold text-white rounded-md transition" style={{ background: "rgba(239,68,68,0.7)" }}>Pause Campaign</button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs transition" style={{ color: "var(--k-text-muted)" }}>Dismiss</button>
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="mt-3 rounded-lg px-4 py-3 text-sm space-y-1" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <p className="text-red-400 font-semibold">❌ Execution Failed</p>
        <p style={{ color: "var(--k-text-muted)" }}>{result.error}</p>
        <button onClick={onClose} className="text-xs mt-1" style={{ color: "var(--k-text-faint)" }}>Dismiss</button>
      </div>
    );
  }

  const isBudget = result.action_type === "increase_budget" || result.action_type === "reduce_budget";
  const isIncrease = result.action_type === "increase_budget";

  return (
    <div className="mt-3 rounded-lg px-4 py-3 text-sm space-y-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)" }}>
      <p className="text-emerald-400 font-semibold">✅ {isBudget ? "Budget Updated" : "Executed Successfully"}</p>
      <div className="space-y-1" style={{ color: "var(--k-text-muted)" }}>
        <div className="flex gap-2"><span className="w-36 shrink-0">Campaign</span><span style={{ color: "var(--k-text)" }}>{result.campaign_name}</span></div>
        {result.new_status && (
          <div className="flex gap-2"><span className="w-36 shrink-0">Status</span>
            <span style={{ color: result.new_status === "PAUSED" ? "#f87171" : "#34d399" }}>{result.new_status}</span>
          </div>
        )}
        {result.executed_at && (
          <div className="flex gap-2"><span className="w-36 shrink-0">Verified at</span><span>{new Date(result.executed_at).toLocaleString("en-IN")}</span></div>
        )}
      </div>
      {isBudget && result.old_budget_inr != null && (
        <div className="mt-2 rounded-md overflow-hidden text-sm" style={{ border: "1px solid var(--k-divider)" }}>
          <div className="flex justify-between px-3 py-1.5" style={{ background: "var(--k-bg2)" }}>
            <span style={{ color: "var(--k-text-muted)" }}>Before</span>
            <span style={{ color: "var(--k-text)" }}>₹{result.old_budget_inr.toLocaleString("en-IN")}/day</span>
          </div>
          <div className="flex justify-between px-3 py-1.5" style={{ background: "var(--k-bg2)", borderTop: "1px solid var(--k-divider)" }}>
            <span style={{ color: "var(--k-text-muted)" }}>After</span>
            <span style={{ color: isIncrease ? "#34d399" : "#f87171" }}>₹{result.new_budget_inr.toLocaleString("en-IN")}/day</span>
          </div>
          <div className="flex justify-between px-3 py-1.5" style={{ background: "var(--k-bg2)", borderTop: "1px solid var(--k-divider)" }}>
            <span style={{ color: "var(--k-text-muted)" }}>Change</span>
            <span style={{ color: isIncrease ? "#34d399" : "#f87171" }}>
              {isIncrease ? "+" : ""}₹{result.change_amount_inr?.toLocaleString("en-IN")}/day
              {result.change_pct != null && ` (${result.change_pct > 0 ? "+" : ""}${result.change_pct}%)`}
            </span>
          </div>
        </div>
      )}
      {result.facebook_url && (
        <a href={result.facebook_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition mt-1">
          View in Ads Manager →
        </a>
      )}
    </div>
  );
}

export default function ActionCard({ action, onExecuted, onDismissed, addToast }) {
  const [mode, setMode]                   = useState("default");
  const [feedback, setFeedback]           = useState("");
  const [currentAction, setCurrentAction] = useState(action);
  const [wasRevised, setWasRevised]       = useState(false);
  const [execResult, setExecResult]       = useState(null);
  const [fadeOut, setFadeOut]             = useState(false);

  const style = TYPE_STYLES[currentAction.action_type] ?? DEFAULT_STYLE;

  async function handleExecute() {
    setExecResult({ loading: true });
    try {
      const res = await fetch(`${API}/api/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type:   currentAction.action_type,
          campaign_name: currentAction.campaign_name,
          increase_pct:  currentAction.increase_pct ?? 20,
          reduce_pct:    currentAction.reduce_pct   ?? 50,
        }),
      });
      const data = await res.json();
      if (!res.ok && data.error !== "minimum_budget") throw new Error(data.error ?? data.detail ?? `API error ${res.status}`);
      setExecResult(data);
      addToast(`✓ ${style.label} executed for "${currentAction.campaign_name}"`, "success");
    } catch (err) {
      setExecResult({ error: err.message });
      addToast(`Execution failed: ${err.message}`, "error");
    }
  }

  function handleResultClose() {
    setExecResult(null);
    if (execResult && execResult.success !== false && !execResult.loading && !execResult.error) {
      triggerFadeOut(() => onExecuted?.(currentAction));
    }
  }

  async function handlePauseFallback(campaignName) {
    setExecResult({ loading: true });
    try {
      const res = await fetch(`${API}/api/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: "pause_campaign", campaign_name: campaignName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
      setExecResult({ ...data, action_type: "pause_campaign" });
      addToast(`Paused "${campaignName}" on Facebook`, "success");
    } catch (err) {
      setExecResult({ error: err.message });
      addToast(`Pause failed: ${err.message}`, "error");
    }
  }

  async function handleDismiss() {
    try {
      await fetch(`${API}/api/actions/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: currentAction.action_type, campaign_name: currentAction.campaign_name, reason: "User dismissed" }),
      });
    } catch (_) {}
    addToast(`Dismissed action for "${currentAction.campaign_name}"`, "info");
    triggerFadeOut(() => onDismissed?.(currentAction));
  }

  async function handleSendFeedback() {
    if (!feedback.trim()) return;
    setMode("reconsidering");
    try {
      const res = await fetch(`${API}/api/insights/regenerate-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ original_action: currentAction, user_feedback: feedback, campaign_name: currentAction.campaign_name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCurrentAction(data.revised_action);
      setWasRevised(true);
      setFeedback("");
      setMode("default");
      addToast("Kampaign.ai reconsidered — new recommendation ready", "success");
    } catch (err) {
      addToast(`Regeneration failed: ${err.message}`, "error");
      setMode("suggest");
    }
  }

  function triggerFadeOut(cb) {
    setFadeOut(true);
    setTimeout(cb, 400);
  }

  return (
    <div
      className={`rounded-xl p-4 transition-all duration-400 ${fadeOut ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
      style={{
        background: "var(--k-card)",
        border: "1px solid var(--k-card-border)",
        borderLeft: `3px solid ${style.border}`,
      }}
    >
      {wasRevised && (
        <div className="mb-3 flex items-center gap-2 text-xs px-3 py-1.5 rounded-md" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
          <span>↻</span>
          <span>Kampaign.ai revised this recommendation based on your feedback</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: style.badgeBg, color: style.badgeColor }}>
            {style.label}
          </span>
          <span className="text-sm font-medium" style={{ color: "var(--k-text)" }}>
            {currentAction.campaign_name}
          </span>
        </div>
        <span className="text-xs font-semibold uppercase" style={{ color: PRIORITY_COLORS[currentAction.priority] ?? "var(--k-text-muted)" }}>
          {currentAction.priority}
        </span>
      </div>

      <p className="text-sm mb-1">
        <span className="text-xs uppercase tracking-wide mr-1" style={{ color: "var(--k-text-faint)" }}>Why</span>
        <span style={{ color: "var(--k-text-muted)" }}>{currentAction.reason}</span>
      </p>
      <p className="text-sm mb-3">
        <span className="text-xs uppercase tracking-wide mr-1" style={{ color: "var(--k-text-faint)" }}>Impact</span>
        <span style={{ color: "var(--k-text-muted)" }}>{currentAction.expected_impact}</span>
      </p>

      {mode === "reconsidering" && (
        <div className="flex items-center gap-2 text-sm py-2 text-indigo-400">
          <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Kampaign.ai is reconsidering…
        </div>
      )}

      {mode === "suggest" && (
        <div className="mt-2 space-y-2">
          <p className="text-xs" style={{ color: "var(--k-text-muted)" }}>Tell Kampaign.ai what to do instead:</p>
          <textarea
            className="k-input w-full px-3 py-2 text-sm resize-none focus:outline-none"
            rows={2}
            placeholder="e.g. Instead of pausing, lower the budget by 30% for 3 days…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleSendFeedback} disabled={!feedback.trim()} className="k-btn px-3 py-1.5 text-xs">Send to AI</button>
            <button onClick={() => { setMode("default"); setFeedback(""); }} className="px-3 py-1.5 text-xs transition" style={{ color: "var(--k-text-muted)" }}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "default" && !execResult && (
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <button onClick={handleExecute} className="k-btn px-3 py-1.5 text-xs">Execute</button>
          <button
            onClick={() => setMode("suggest")}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition"
            style={{ border: "1px solid var(--k-card-border)", color: "var(--k-text-muted)" }}
          >
            Suggest Alternative
          </button>
          <button onClick={handleDismiss} className="px-3 py-1.5 text-xs ml-auto transition" style={{ color: "var(--k-text-faint)" }}>
            Dismiss
          </button>
        </div>
      )}

      {execResult && (
        <>
          <ExecuteResultPanel result={execResult} onClose={handleResultClose} onPauseFallback={handlePauseFallback} />
          {!execResult.loading && (
            <div className="mt-2 flex gap-2">
              {execResult.success !== false && !execResult.error && (
                <button onClick={() => triggerFadeOut(() => onExecuted?.(currentAction))} className="k-btn px-3 py-1.5 text-xs">Done</button>
              )}
              {execResult.error && (
                <button onClick={() => setExecResult(null)} className="px-3 py-1.5 text-xs transition" style={{ color: "var(--k-text-muted)" }}>Try again</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
