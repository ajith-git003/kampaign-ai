// Kampaign.ai — AI-native campaign engine — Ad Copy Generator page
import { useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TONES = ["professional", "playful", "urgent", "inspirational", "conversational"];

const SCORE_TOOLTIP =
  "How similar this copy is to your historical top-performing ads. " +
  "Low scores are normal when historical copy data is limited.";

function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return (
      <div className="shrink-0" title={SCORE_TOOLTIP}>
        <span className="inline-block text-xs bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full animate-pulse w-20 text-center">
          scoring…
        </span>
      </div>
    );
  }

  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "bg-green-900 text-green-300" :
    pct >= 45 ? "bg-indigo-900 text-indigo-300" :
                "bg-gray-800 text-gray-400";

  return (
    <div className="shrink-0 cursor-help" title={SCORE_TOOLTIP}>
      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${color}`}>
        Similarity {pct}%
      </span>
    </div>
  );
}

export default function Creatives() {
  const [form, setForm] = useState({
    product_name: "",
    target_audience: "",
    tone: "professional",
    num_variants: 3,
  });
  const [variants, setVariants]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [scoring, setScoring]       = useState(false);
  const [error, setError]           = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVariants([]);

    try {
      // ── Phase 1: Generate (fast) — no scores yet ─────────────────────────
      const res = await fetch(`${API}/api/creatives/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, num_variants: Number(form.num_variants) }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail ?? `API error ${res.status}`);
      }
      const generated = await res.json();
      setVariants(generated);          // show immediately — scores are null
      setLoading(false);

      // ── Phase 2: Score in background ────────────────────────────────────
      setScoring(true);
      const ids = generated.map((v) => v.id);
      const scoreRes = await fetch(`${API}/api/creatives/score-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creative_ids: ids }),
      });
      if (scoreRes.ok) {
        const scores = await scoreRes.json(); // [{id, score}]
        const scoreMap = Object.fromEntries(scores.map((s) => [s.id, s.score]));
        setVariants((prev) =>
          prev.map((v) => ({ ...v, score: scoreMap[v.id] ?? v.score }))
        );
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    } finally {
      setScoring(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Ad Copy Generator</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI-generated copy variations for your campaigns
        </p>
        <p className="text-gray-600 text-xs mt-1">
          Powered by GPT-4o-mini — Kampaign.ai AI-native campaign engine
        </p>
      </div>

      <form onSubmit={handleGenerate} className="space-y-4">
        {[
          {
            key: "product_name",
            label: "Product / Brand Name",
            placeholder: "e.g. Glowra Vitamin C Serum",
          },
          {
            key: "target_audience",
            label: "Target Audience",
            placeholder: "e.g. Women 25–40, skincare enthusiasts",
          },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm text-gray-300 mb-1">{label}</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={placeholder}
              required
            />
          </div>
        ))}

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-1">Tone</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Variants</label>
            <select
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              value={form.num_variants}
              onChange={(e) => setForm({ ...form, num_variants: e.target.value })}
            >
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded transition-colors"
        >
          {loading ? "Generating…" : "Generate Copy"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>

      {variants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Generated Variants</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Scores will improve as Kampaign.ai learns from your campaign performance data.
              </p>
            </div>
            {scoring && (
              <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scoring…
              </span>
            )}
          </div>

          {variants.map((v, i) => (
            <div
              key={v.id ?? i}
              className="bg-[#1e2235] rounded-lg p-4 border border-gray-700/50 space-y-2"
            >
              <div className="flex justify-between items-start gap-4">
                <p className="font-semibold text-white">{v.headline}</p>
                <ScoreBadge score={v.score} />
              </div>
              {v.body && (
                <p className="text-gray-300 text-sm leading-relaxed">{v.body}</p>
              )}
              {v.cta && (
                <p className="text-indigo-400 text-sm font-medium">CTA: {v.cta}</p>
              )}
            </div>
          ))}

          <p className="text-xs text-gray-600 italic">
            Image creative generation coming soon
          </p>
        </div>
      )}
    </div>
  );
}
