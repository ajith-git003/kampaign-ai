// Kampaign.ai — AI-native campaign engine — ActionCard component
// Three modes: default | suggest | reconsidering
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Styling maps ──────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  pause_campaign:   { border: "border-l-red-500",    badge: "bg-red-900/60 text-red-300",     label: "Pause"           },
  increase_budget:  { border: "border-l-green-500",  badge: "bg-green-900/60 text-green-300", label: "Increase Budget"  },
  reduce_budget:    { border: "border-l-orange-500", badge: "bg-orange-900/60 text-orange-300",label: "Reduce Budget"   },
  launch_campaign:  { border: "border-l-indigo-500", badge: "bg-indigo-900/60 text-indigo-300",label: "Launch"          },
  activate_campaign:{ border: "border-l-amber-500",  badge: "bg-amber-900/60 text-amber-300", label: "Activate"        },
};

const PRIORITY_COLORS = {
  high:   "text-red-400",
  medium: "text-amber-400",
  low:    "text-gray-400",
};

const DEFAULT_STYLE = { border: "border-l-gray-500", badge: "bg-gray-800 text-gray-300", label: "Action" };

// ── Execute Result Panel ──────────────────────────────────────────────────────

function ExecuteResultPanel({ result, onClose, onPauseFallback }) {
  if (result.loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-gray-300 bg-[#141622] rounded-lg px-4 py-3 border border-gray-700">
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
      <div className="mt-3 bg-yellow-900/20 border border-yellow-600 rounded-lg px-4 py-3 text-sm space-y-2">
        <p className="text-yellow-400 font-semibold">⚠️ Cannot Reduce Budget</p>
        <div className="text-gray-300 space-y-1">
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Current budget</span>
            <span>₹{result.current_budget_inr?.toLocaleString("en-IN")}/day</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Minimum allowed</span>
            <span>₹{result.minimum_budget_inr?.toLocaleString("en-IN")}/day</span>
          </div>
        </div>
        <p className="text-yellow-300/70 text-xs">
          Facebook requires campaigns to maintain at least ₹{result.minimum_budget_inr?.toLocaleString("en-IN")}/day.
        </p>
        <p className="text-gray-400 text-xs">Consider pausing this campaign instead.</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onPauseFallback(result.campaign_name)}
            className="px-3 py-1.5 text-xs font-semibold bg-red-800 hover:bg-red-700 text-white rounded-md transition"
          >
            Pause Campaign
          </button>
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="mt-3 bg-red-900/20 border border-red-700 rounded-lg px-4 py-3 text-sm space-y-1">
        <p className="text-red-400 font-semibold">❌ Execution Failed</p>
        <p className="text-red-300">{result.error}</p>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 mt-1">Dismiss</button>
      </div>
    );
  }

  const isBudgetAction = result.action_type === "increase_budget" || result.action_type === "reduce_budget";
  const isIncrease = result.action_type === "increase_budget";

  return (
    <div className="mt-3 bg-green-900/20 border border-green-700 rounded-lg px-4 py-3 text-sm space-y-2">
      <p className="text-green-400 font-semibold">
        ✅ {isBudgetAction ? "Budget Updated" : "Executed Successfully"}
      </p>

      <div className="text-gray-300 space-y-1">
        <div className="flex gap-2">
          <span className="text-gray-500 w-36 shrink-0">Campaign</span>
          <span>{result.campaign_name}</span>
        </div>
        {result.fb_campaign_id && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Facebook ID</span>
            <span className="font-mono text-xs">{result.fb_campaign_id}</span>
          </div>
        )}
        {result.budget_source && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Budget source</span>
            <span className="capitalize">{result.budget_source}</span>
          </div>
        )}
        {result.new_status && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Status</span>
            <span className={result.new_status === "PAUSED" ? "text-red-300" : "text-green-300"}>
              {result.new_status}
            </span>
          </div>
        )}
        {result.verified !== undefined && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Verified</span>
            <span>{result.verified ? "✓ Confirmed on Facebook" : "Pending"}</span>
          </div>
        )}
        {result.executed_at && (
          <div className="flex gap-2">
            <span className="text-gray-500 w-36 shrink-0">Verified at</span>
            <span>{new Date(result.executed_at).toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      {/* Budget breakdown in INR */}
      {isBudgetAction && result.old_budget_inr != null && (
        <div className="mt-2 border border-gray-700 rounded-md overflow-hidden text-sm">
          <div className="flex justify-between px-3 py-1.5 bg-[#141622]">
            <span className="text-gray-400">Before</span>
            <span className="text-gray-200">₹{result.old_budget_inr.toLocaleString("en-IN")}/day</span>
          </div>
          <div className="flex justify-between px-3 py-1.5 border-t border-gray-700 bg-[#141622]">
            <span className="text-gray-400">After</span>
            <span className={isIncrease ? "text-green-300" : "text-red-300"}>
              ₹{result.new_budget_inr.toLocaleString("en-IN")}/day
            </span>
          </div>
          <div className="flex justify-between px-3 py-1.5 border-t border-gray-700 bg-[#141622]">
            <span className="text-gray-400">Change</span>
            <span className={isIncrease ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
              {isIncrease ? "+" : ""}₹{result.change_amount_inr?.toLocaleString("en-IN")}/day
              {result.change_pct != null && ` (${result.change_pct > 0 ? "+" : ""}${result.change_pct}%)`}
            </span>
          </div>
        </div>
      )}

      {result.facebook_url && (
        <a
          href={result.facebook_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition mt-1"
        >
          View in Ads Manager →
        </a>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * ActionCard — human-in-the-loop AI action card.
 *
 * Props:
 *   action      {object}   — action from /api/insights/latest
 *   onExecuted  {Function} — called after successful execution
 *   onDismissed {Function} — called after dismiss
 *   addToast    {Function} — from useToasts()
 */
export default function ActionCard({ action, onExecuted, onDismissed, addToast }) {
  const navigate = useNavigate();

  const [mode, setMode]                   = useState("default"); // default | suggest | reconsidering
  const [feedback, setFeedback]           = useState("");
  const [currentAction, setCurrentAction] = useState(action);
  const [wasRevised, setWasRevised]       = useState(false);
  const [execResult, setExecResult]       = useState(null);  // null | {loading} | {success data} | {error}
  const [fadeOut, setFadeOut]             = useState(false);

  const style = TYPE_STYLES[currentAction.action_type] ?? DEFAULT_STYLE;

  // ── Execute ───────────────────────────────────────────────────────────────

  async function handleExecute() {
    if (currentAction.action_type === "launch_campaign") {
      navigate("/campaigns/new");
      return;
    }

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
      // minimum_budget is a soft failure — show special warning panel, not an error throw
      if (!res.ok && data.error !== "minimum_budget") {
        throw new Error(data.error ?? data.detail ?? `API error ${res.status}`);
      }
      setExecResult(data);
      addToast(
        `✓ ${style.label} executed for "${currentAction.campaign_name}"`,
        "success"
      );
      // Don't auto-remove — user can see result then close
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

  // ── Pause fallback (from minimum_budget warning) ──────────────────────────

  async function handlePauseFallback(campaignName) {
    setExecResult({ loading: true });
    try {
      const res = await fetch(`${API}/api/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type:   "pause_campaign",
          campaign_name: campaignName,
        }),
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

  // ── Dismiss ───────────────────────────────────────────────────────────────

  async function handleDismiss() {
    try {
      await fetch(`${API}/api/actions/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type:   currentAction.action_type,
          campaign_name: currentAction.campaign_name,
          reason:        "User dismissed",
        }),
      });
    } catch (_) {
      // best-effort
    }
    addToast(`Dismissed action for "${currentAction.campaign_name}"`, "info");
    triggerFadeOut(() => onDismissed?.(currentAction));
  }

  // ── Regenerate (suggest alternative) ─────────────────────────────────────

  async function handleSendFeedback() {
    if (!feedback.trim()) return;
    setMode("reconsidering");
    try {
      const res = await fetch(`${API}/api/insights/regenerate-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_action: currentAction,
          user_feedback:   feedback,
          campaign_name:   currentAction.campaign_name,
        }),
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  function triggerFadeOut(cb) {
    setFadeOut(true);
    setTimeout(cb, 400);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`
        relative bg-[#1e2235] border-l-4 ${style.border} rounded-lg p-4
        transition-all duration-400
        ${fadeOut ? "opacity-0 scale-95" : "opacity-100 scale-100"}
      `}
    >
      {/* FIX 3 — revised banner */}
      {wasRevised && (
        <div className="mb-3 flex items-center gap-2 text-xs text-blue-300 bg-blue-900/20 border border-blue-700/50 rounded-md px-3 py-1.5">
          <span>↻</span>
          <span>Kampaign.ai revised this recommendation based on your feedback</span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {style.label}
          </span>
          <span className="text-sm font-medium text-white">
            {currentAction.campaign_name}
          </span>
        </div>
        <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[currentAction.priority] ?? "text-gray-400"}`}>
          {currentAction.priority}
        </span>
      </div>

      {/* Reason */}
      <p className="text-sm text-gray-300 mb-1">
        <span className="text-gray-500 text-xs uppercase tracking-wide mr-1">Why</span>
        {currentAction.reason}
      </p>

      {/* Expected impact */}
      <p className="text-sm text-gray-400 mb-3">
        <span className="text-gray-500 text-xs uppercase tracking-wide mr-1">Impact</span>
        {currentAction.expected_impact}
      </p>

      {/* ── Mode: reconsidering ── */}
      {mode === "reconsidering" && (
        <div className="flex items-center gap-2 text-sm text-indigo-300 py-2">
          <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Kampaign.ai is reconsidering…
        </div>
      )}

      {/* ── Mode: suggest alternative ── */}
      {mode === "suggest" && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-400">Tell Kampaign.ai what to do instead:</p>
          <textarea
            className="w-full bg-[#141622] border border-gray-700 rounded-md px-3 py-2 text-sm
                       text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="e.g. Instead of pausing, lower the budget by 30% for 3 days…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSendFeedback}
              disabled={!feedback.trim()}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500
                         disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition"
            >
              Send to AI
            </button>
            <button
              onClick={() => { setMode("default"); setFeedback(""); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Mode: default — action buttons ── */}
      {mode === "default" && !execResult && (
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <button
            onClick={handleExecute}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500
                       text-white rounded-md transition"
          >
            {currentAction.action_type === "launch_campaign" ? "Go to Launch →" : "Execute"}
          </button>
          <button
            onClick={() => setMode("suggest")}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-600 hover:border-gray-400
                       text-gray-300 hover:text-white rounded-md transition"
          >
            Suggest Alternative
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition ml-auto"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Execute result panel (FIX 1+2) ── */}
      {execResult && (
        <>
          <ExecuteResultPanel result={execResult} onClose={handleResultClose} onPauseFallback={handlePauseFallback} />
          {!execResult.loading && (
            <div className="mt-2 flex gap-2">
              {execResult.success !== false && !execResult.error && (
                <button
                  onClick={() => triggerFadeOut(() => onExecuted?.(currentAction))}
                  className="px-3 py-1.5 text-xs font-semibold bg-green-800 hover:bg-green-700
                             text-white rounded-md transition"
                >
                  Done
                </button>
              )}
              {execResult.error && (
                <button
                  onClick={() => setExecResult(null)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
