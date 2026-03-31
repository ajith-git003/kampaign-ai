// Kampaign.ai — AI-native campaign engine — Launch page
import { useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const OBJECTIVES = [
  { value: "OUTCOME_TRAFFIC",    label: "Traffic"     },
  { value: "OUTCOME_SALES",      label: "Sales"       },
  { value: "OUTCOME_LEADS",      label: "Leads"       },
  { value: "OUTCOME_AWARENESS",  label: "Awareness"   },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement"  },
];

function SuccessRow({ label, value, mono = false }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 w-40 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs text-gray-200" : "text-gray-200"}>{value}</span>
    </div>
  );
}

export default function Launch() {
  const [form, setForm] = useState({
    name: "",
    objective: "OUTCOME_TRAFFIC",
    daily_budget: "",
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/campaigns/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          daily_budget: form.daily_budget ? Number(form.daily_budget) : null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail ?? `API error ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Launch Campaign</h1>
        <p className="text-gray-400 text-sm mt-1">
          Create and launch a campaign in Kampaign.ai and Facebook Ads Manager.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Campaign Name</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Summer Sale 2025"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Objective</label>
          <select
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Daily Budget (₹ INR)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.daily_budget}
            onChange={(e) => setForm({ ...form, daily_budget: e.target.value })}
            placeholder="50.00"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded transition-colors"
        >
          {loading ? "Creating…" : "Create Campaign"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>

      {result && (
        <div className="bg-[#1e2235] rounded-lg p-5 border border-gray-700 space-y-4">
          {/* Kampaign.ai status */}
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-semibold text-sm">
              {result.kampaign_success ? "✅" : "❌"} Campaign created in Kampaign.ai
            </span>
          </div>

          {/* Facebook status */}
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${result.facebook_success ? "text-green-400" : "text-yellow-400"}`}>
              {result.facebook_success ? "✅" : "⚠️"} Campaign{" "}
              {result.facebook_success ? "created in" : "not synced to"} Facebook Ads Manager
            </span>
          </div>

          {result.fb_error && (
            <p className="text-yellow-300/70 text-xs bg-yellow-900/20 rounded px-3 py-2 border border-yellow-800/40">
              Facebook: {result.fb_error}
            </p>
          )}

          <div className="border-t border-gray-700 pt-3 space-y-1.5">
            <SuccessRow label="Kampaign.ai ID" value={result.id} mono />
            <SuccessRow label="Campaign Name"  value={result.name} />
            <SuccessRow label="Objective"      value={result.objective ?? "—"} />
            <SuccessRow label="Status"         value={result.status} />
            {result.fb_campaign_id && (
              <SuccessRow label="Facebook Campaign ID" value={result.fb_campaign_id} mono />
            )}
            {result.fb_new_status && (
              <SuccessRow label="Facebook Status" value={result.fb_new_status} />
            )}
          </div>

          {result.facebook_url && (
            <a
              href={result.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition"
            >
              View in Ads Manager →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
