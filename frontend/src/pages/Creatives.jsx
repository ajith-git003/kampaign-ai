// Kampaign.ai — AI-native campaign engine — Creatives page
import { useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TONES = ["professional", "playful", "urgent", "inspirational", "conversational"];
const OBJECTIVES = ["Purchases", "Leads", "Traffic", "Awareness", "Engagement"];

const SCORE_TOOLTIP =
  "How similar this copy is to your historical top-performing ads. " +
  "Low scores are normal when historical copy data is limited.";

// ── Copy Generator sub-components ────────────────────────────────────────────

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

// ── Audit sub-components ──────────────────────────────────────────────────────

function ScoreCircle({ score }) {
  const radius = 44;
  const circ   = 2 * Math.PI * radius;
  const fill   = (score / 100) * circ;

  const color =
    score >= 80 ? "#22c55e" :
    score >= 60 ? "#eab308" :
                  "#ef4444";

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#374151" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="56" textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="24" fontWeight="bold">
        {score}
      </text>
      <text x="60" y="74" textAnchor="middle" fill="#9ca3af" fontSize="11">
        /100
      </text>
    </svg>
  );
}

function GradeBadge({ grade }) {
  const colors = {
    A: "bg-green-900/60 text-green-300 border-green-700",
    B: "bg-blue-900/60 text-blue-300 border-blue-700",
    C: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
    D: "bg-orange-900/60 text-orange-300 border-orange-700",
    F: "bg-red-900/60 text-red-300 border-red-700",
  };
  return (
    <span className={`text-4xl font-black px-4 py-2 rounded-xl border-2 ${colors[grade] ?? colors.C}`}>
      {grade}
    </span>
  );
}

function CriterionRow({ c }) {
  const barColor =
    c.score >= 8 ? "bg-green-500" :
    c.score >= 6 ? "bg-yellow-500" :
                   "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-base">{c.passed ? "✅" : "❌"}</span>
        <span className="text-sm font-medium text-white flex-1">{c.name}</span>
        <span className="text-xs text-gray-400 shrink-0">{c.score}/10</span>
      </div>
      <div className="ml-8 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${(c.score / 10) * 100}%` }}
        />
      </div>
      <p className="ml-8 text-xs text-gray-500 leading-relaxed">{c.feedback}</p>
    </div>
  );
}

// ── Copy Generator tab ────────────────────────────────────────────────────────

function CopyGeneratorTab() {
  const [form, setForm] = useState({
    product_name: "",
    target_audience: "",
    tone: "professional",
    num_variants: 3,
  });
  const [variants, setVariants] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [scoring, setScoring]   = useState(false);
  const [error, setError]       = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVariants([]);

    try {
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
      setVariants(generated);
      setLoading(false);

      setScoring(true);
      const ids = generated.map((v) => v.id);
      const scoreRes = await fetch(`${API}/api/creatives/score-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creative_ids: ids }),
      });
      if (scoreRes.ok) {
        const scores = await scoreRes.json();
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
    <div className="space-y-8">
      <form onSubmit={handleGenerate} className="space-y-4">
        {[
          { key: "product_name",    label: "Product / Brand Name", placeholder: "e.g. Glowra Vitamin C Serum" },
          { key: "target_audience", label: "Target Audience",      placeholder: "e.g. Women 25–40, skincare enthusiasts" },
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
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
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
              {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
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
            <div key={v.id ?? i} className="bg-[#1e2235] rounded-lg p-4 border border-gray-700/50 space-y-2">
              <div className="flex justify-between items-start gap-4">
                <p className="font-semibold text-white">{v.headline}</p>
                <ScoreBadge score={v.score} />
              </div>
              {v.body && <p className="text-gray-300 text-sm leading-relaxed">{v.body}</p>}
              {v.cta  && <p className="text-indigo-400 text-sm font-medium">CTA: {v.cta}</p>}
            </div>
          ))}

          <p className="text-xs text-gray-600 italic">Image creative generation coming soon</p>
        </div>
      )}
    </div>
  );
}

// ── Creative Audit tab ────────────────────────────────────────────────────────

function CreativeAuditTab() {
  const inputRef                  = useRef(null);
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null); // data-url for images
  const [objective, setObjective] = useState("Purchases");
  const [audience, setAudience]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [dragging, setDragging]   = useState(false);

  function handleFileSelect(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null); // video: show filename only
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }

  async function handleAudit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("campaign_objective", objective);
    fd.append("target_audience", audience);

    try {
      const res = await fetch(`${API}/api/creatives/audit`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? `API error ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const scoreColor =
    result?.overall_score >= 80 ? "text-green-400" :
    result?.overall_score >= 60 ? "text-yellow-400" :
                                   "text-red-400";

  return (
    <div className="space-y-6">

      {/* Upload area */}
      {!result && (
        <form onSubmit={handleAudit} className="space-y-5">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragging ? "border-indigo-500 bg-indigo-900/10" : "border-gray-700 hover:border-gray-500"}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />

            {!file ? (
              <>
                <div className="text-4xl mb-3">🖼️</div>
                <p className="text-gray-300 font-medium">Drag &amp; drop your ad creative here</p>
                <p className="text-gray-600 text-sm mt-1">Supports JPG, PNG, WEBP, MP4 (max 10 MB)</p>
                <p className="text-gray-700 text-xs mt-3">or click to browse files</p>
              </>
            ) : preview ? (
              <img
                src={preview}
                alt="preview"
                className="max-h-56 max-w-full mx-auto rounded-lg object-contain"
              />
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">🎬</div>
                <p className="text-gray-300 text-sm font-medium">{file.name}</p>
                <p className="text-gray-600 text-xs">First frame will be extracted for analysis</p>
              </div>
            )}
          </div>

          {file && (
            <p className="text-xs text-gray-600 -mt-2 text-center">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
              <button
                type="button"
                className="ml-3 text-gray-500 hover:text-red-400 transition-colors"
                onClick={() => { setFile(null); setPreview(null); }}
              >
                Remove
              </button>
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Campaign Objective</label>
              <select
                className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              >
                {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Target Audience</label>
              <input
                className="w-full bg-[#141622] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Women 25-40 interested in skincare"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Analyzing your creative…
              </span>
            ) : "Audit My Creative"}
          </button>
          {loading && (
            <p className="text-center text-xs text-gray-600">This usually takes 10–15 seconds</p>
          )}
        </form>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          <button
            onClick={() => { setResult(null); setFile(null); setPreview(null); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Audit another creative
          </button>

          {/* Score header */}
          <div className="bg-[#1e2235] border border-gray-700/50 rounded-xl p-5">
            <div className="flex items-center gap-6">
              <ScoreCircle score={result.overall_score} />
              <div className="space-y-3">
                <GradeBadge grade={result.grade} />
                <p className={`text-lg font-semibold ${scoreColor}`}>
                  {result.overall_score >= 80 ? "Strong creative" :
                   result.overall_score >= 60 ? "Needs some work" : "Needs major revision"}
                </p>
                <p className="text-sm text-gray-400 leading-relaxed max-w-md">{result.verdict}</p>
              </div>
            </div>
          </div>

          {/* Criteria breakdown */}
          <div className="bg-[#1e2235] border border-gray-700/50 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-white">Criteria Breakdown</h3>
            {result.criteria?.map((c, i) => (
              <CriterionRow key={i} c={c} />
            ))}
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-green-400">Strengths</h3>
              {result.strengths?.map((s, i) => (
                <p key={i} className="text-sm text-gray-300 flex gap-2">
                  <span>✅</span><span>{s}</span>
                </p>
              ))}
            </div>
            <div className="bg-orange-900/20 border border-orange-800/40 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-orange-400">Improvements Needed</h3>
              {result.improvements?.map((imp, i) => (
                <p key={i} className="text-sm text-gray-300 flex gap-2">
                  <span>⚠️</span><span>{imp}</span>
                </p>
              ))}
            </div>
          </div>

          {/* Policy flags */}
          {result.facebook_policy_flags?.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-400">Facebook Policy Flags</h3>
              {result.facebook_policy_flags.map((flag, i) => (
                <p key={i} className="text-sm text-gray-300 flex gap-2">
                  <span>🚫</span><span>{flag}</span>
                </p>
              ))}
            </div>
          )}

          {/* Specs link */}
          <a
            href="https://www.facebook.com/business/ads-guide"
            target="_blank"
            rel="noreferrer"
            className="block text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View Facebook Ad Specs &amp; Guidelines →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Creatives() {
  const [tab, setTab] = useState("copy");

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Creatives</h1>
        <p className="text-gray-400 text-sm mt-1">
          AI-powered copy generation and creative auditing
        </p>
        <p className="text-gray-600 text-xs mt-1">
          Powered by GPT-4o-mini &amp; GPT-4o Vision — Kampaign.ai AI-native campaign engine
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#141622] border border-gray-700/50 rounded-lg p-1 w-fit">
        {[
          { key: "copy",  label: "Copy Generator" },
          { key: "audit", label: "Creative Audit"  },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "copy"  && <CopyGeneratorTab />}
      {tab === "audit" && <CreativeAuditTab />}
    </div>
  );
}
