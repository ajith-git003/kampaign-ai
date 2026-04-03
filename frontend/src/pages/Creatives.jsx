// Kampaign.ai — Creatives page
import { useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TONES      = ["professional", "playful", "urgent", "inspirational", "conversational"];
const OBJECTIVES = ["Purchases", "Leads", "Traffic", "Awareness", "Engagement"];

const SCORE_TOOLTIP =
  "How similar this copy is to your historical top-performing ads. " +
  "Low scores are normal when historical copy data is limited.";

// ── Shared ────────────────────────────────────────────────────────────────────

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}>
      {children}
    </div>
  );
}

const inputCls = "k-input w-full px-3 py-2 text-sm focus:outline-none";

// ── Copy Generator sub-components ────────────────────────────────────────────

function ScoreBadge({ score }) {
  if (score == null) {
    return (
      <div className="shrink-0" title={SCORE_TOOLTIP}>
        <span className="inline-block text-xs px-2 py-0.5 rounded-full animate-pulse w-20 text-center"
              style={{ background: "var(--k-bg2)", color: "var(--k-text-faint)" }}>
          scoring…
        </span>
      </div>
    );
  }
  const p = Math.round(score * 100);
  const style =
    p >= 70 ? { bg: "rgba(16,185,129,0.12)",  color: "#34d399"  } :
    p >= 45 ? { bg: "rgba(99,102,241,0.12)",   color: "#a5b4fc"  } :
              { bg: "rgba(107,114,128,0.12)",  color: "var(--k-text-muted)" };
  return (
    <div className="shrink-0 cursor-help" title={SCORE_TOOLTIP}>
      <span className="inline-block text-xs px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>
        Similarity {p}%
      </span>
    </div>
  );
}

// ── Audit sub-components ──────────────────────────────────────────────────────

function ScoreCircle({ score }) {
  const radius = 44;
  const circ   = 2 * Math.PI * radius;
  const fill   = (score / 100) * circ;
  const color  = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--k-divider)" strokeWidth="10" />
      <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10"
              strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
      <text x="60" y="56" textAnchor="middle" dominantBaseline="middle" fill="var(--k-text)" fontSize="24" fontWeight="bold">{score}</text>
      <text x="60" y="74" textAnchor="middle" fill="var(--k-text-muted)" fontSize="11">/100</text>
    </svg>
  );
}

function GradeBadge({ grade }) {
  const styles = {
    A: { bg: "rgba(16,185,129,0.12)",  color: "#34d399", border: "rgba(16,185,129,0.4)" },
    B: { bg: "rgba(99,102,241,0.12)",  color: "#a5b4fc", border: "rgba(99,102,241,0.4)" },
    C: { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24", border: "rgba(245,158,11,0.4)" },
    D: { bg: "rgba(249,115,22,0.12)",  color: "#fb923c", border: "rgba(249,115,22,0.4)" },
    F: { bg: "rgba(239,68,68,0.12)",   color: "#f87171", border: "rgba(239,68,68,0.4)"  },
  };
  const s = styles[grade] ?? styles.C;
  return (
    <span className="text-4xl font-black px-4 py-2 rounded-xl" style={{ background: s.bg, color: s.color, border: `2px solid ${s.border}` }}>
      {grade}
    </span>
  );
}

function CriterionRow({ c }) {
  const barColor = c.score >= 8 ? "#22c55e" : c.score >= 6 ? "#eab308" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="text-base">{c.passed ? "✅" : "❌"}</span>
        <span className="text-sm font-medium flex-1" style={{ color: "var(--k-text)" }}>{c.name}</span>
        <span className="text-xs shrink-0" style={{ color: "var(--k-text-muted)" }}>{c.score}/10</span>
      </div>
      <div className="ml-8 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--k-divider)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(c.score / 10) * 100}%`, background: barColor }} />
      </div>
      <p className="ml-8 text-xs leading-relaxed" style={{ color: "var(--k-text-faint)" }}>{c.feedback}</p>
    </div>
  );
}

// ── Copy Generator tab ────────────────────────────────────────────────────────

function CopyGeneratorTab() {
  const [form, setForm]       = useState({ product_name: "", target_audience: "", tone: "professional", num_variants: 3 });
  const [variants, setVariants] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [scoring, setScoring]   = useState(false);
  const [error, setError]       = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setVariants([]);
    try {
      const res = await fetch(`${API}/api/creatives/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, num_variants: Number(form.num_variants) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.detail ?? `API error ${res.status}`); }
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
        setVariants((prev) => prev.map((v) => ({ ...v, score: scoreMap[v.id] ?? v.score })));
      }
    } catch (err) { setError(err.message); setLoading(false); }
    finally { setScoring(false); }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleGenerate} className="space-y-4">
        {[
          { key: "product_name",    label: "Product / Brand Name", placeholder: "e.g. Glowra Vitamin C Serum" },
          { key: "target_audience", label: "Target Audience",      placeholder: "e.g. Women 25–40, skincare enthusiasts" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--k-text-muted)" }}>{label}</label>
            <input className={inputCls} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} required />
          </div>
        ))}

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--k-text-muted)" }}>Tone</label>
            <select className={inputCls} value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
              {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--k-text-muted)" }}>Variants</label>
            <select className="k-input px-3 py-2 text-sm focus:outline-none" value={form.num_variants} onChange={(e) => setForm({ ...form, num_variants: e.target.value })}>
              {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} className="k-btn px-5 py-2 text-sm">
          {loading ? "Generating…" : "Generate Copy"}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>

      {variants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--k-text)" }}>Generated Variants</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--k-text-muted)" }}>
                Scores improve as Kampaign.ai learns from your campaign data.
              </p>
            </div>
            {scoring && (
              <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: "var(--k-text-muted)" }}>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scoring…
              </span>
            )}
          </div>

          {variants.map((v, i) => (
            <div key={v.id ?? i} className="rounded-xl p-4 space-y-2" style={{ background: "var(--k-card)", border: "1px solid var(--k-card-border)" }}>
              <div className="flex justify-between items-start gap-4">
                <p className="font-semibold" style={{ color: "var(--k-text)" }}>{v.headline}</p>
                <ScoreBadge score={v.score} />
              </div>
              {v.body && <p className="text-sm leading-relaxed" style={{ color: "var(--k-text-muted)" }}>{v.body}</p>}
              {v.cta  && <p className="text-sm font-medium text-indigo-400">CTA: {v.cta}</p>}
            </div>
          ))}

          <p className="text-xs italic" style={{ color: "var(--k-text-faint)" }}>Image creative generation coming soon</p>
        </div>
      )}
    </div>
  );
}

// ── Creative Audit tab ────────────────────────────────────────────────────────

function CreativeAuditTab() {
  const inputRef                  = useRef(null);
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [objective, setObjective] = useState("Purchases");
  const [audience, setAudience]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [dragging, setDragging]   = useState(false);

  function handleFileSelect(f) {
    if (!f) return;
    setFile(f); setResult(null); setError(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else { setPreview(null); }
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  }

  async function handleAudit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("campaign_objective", objective); fd.append("target_audience", audience);
    try {
      const res = await fetch(`${API}/api/creatives/audit`, { method: "POST", body: fd });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? `API error ${res.status}`); }
      setResult(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const scoreColor = result?.overall_score >= 80 ? "text-emerald-400" : result?.overall_score >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      {!result && (
        <form onSubmit={handleAudit} className="space-y-5">
          {/* Drop zone */}
          <div
            className="rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{
              border: `2px dashed ${dragging ? "#6366f1" : "var(--k-card-border)"}`,
              background: dragging ? "rgba(99,102,241,0.05)" : "var(--k-bg2)",
            }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="hidden"
                   onChange={(e) => handleFileSelect(e.target.files[0])} />

            {!file ? (
              <>
                <div className="text-4xl mb-3">🖼️</div>
                <p className="font-medium" style={{ color: "var(--k-text)" }}>Drag &amp; drop your ad creative here</p>
                <p className="text-sm mt-1" style={{ color: "var(--k-text-muted)" }}>Supports JPG, PNG, WEBP, MP4 (max 10 MB)</p>
                <p className="text-xs mt-3" style={{ color: "var(--k-text-faint)" }}>or click to browse files</p>
              </>
            ) : preview ? (
              <img src={preview} alt="preview" className="max-h-56 max-w-full mx-auto rounded-lg object-contain" />
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">🎬</div>
                <p className="text-sm font-medium" style={{ color: "var(--k-text)" }}>{file.name}</p>
                <p className="text-xs" style={{ color: "var(--k-text-muted)" }}>First frame will be extracted for analysis</p>
              </div>
            )}
          </div>

          {file && (
            <p className="text-xs -mt-2 text-center" style={{ color: "var(--k-text-faint)" }}>
              {file.name} · {(file.size / 1024).toFixed(0)} KB
              <button type="button" className="ml-3 hover:text-red-400 transition-colors" onClick={() => { setFile(null); setPreview(null); }}>
                Remove
              </button>
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--k-text-muted)" }}>Campaign Objective</label>
              <select className={inputCls} value={objective} onChange={(e) => setObjective(e.target.value)}>
                {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1.5 font-medium" style={{ color: "var(--k-text-muted)" }}>Target Audience</label>
              <input className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}
                     placeholder="e.g. Women 25-40 interested in skincare" required />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={!file || loading} className="k-btn w-full py-2.5 text-sm">
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
          {loading && <p className="text-center text-xs" style={{ color: "var(--k-text-faint)" }}>This usually takes 10–15 seconds</p>}
        </form>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          <button onClick={() => { setResult(null); setFile(null); setPreview(null); }}
                  className="text-xs transition" style={{ color: "var(--k-text-faint)" }}>
            ← Audit another creative
          </button>

          {/* Score header */}
          <Card>
            <div className="flex items-center gap-6">
              <ScoreCircle score={result.overall_score} />
              <div className="space-y-3">
                <GradeBadge grade={result.grade} />
                <p className={`text-lg font-semibold ${scoreColor}`}>
                  {result.overall_score >= 80 ? "Strong creative" : result.overall_score >= 60 ? "Needs some work" : "Needs major revision"}
                </p>
                <p className="text-sm leading-relaxed max-w-md" style={{ color: "var(--k-text-muted)" }}>{result.verdict}</p>
              </div>
            </div>
          </Card>

          {/* Criteria */}
          <Card>
            <h3 className="text-sm font-semibold" style={{ color: "var(--k-text)" }}>Criteria Breakdown</h3>
            <div className="space-y-5">
              {result.criteria?.map((c, i) => <CriterionRow key={i} c={c} />)}
            </div>
          </Card>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <h3 className="text-sm font-semibold text-emerald-400">Strengths</h3>
              {result.strengths?.map((s, i) => (
                <p key={i} className="text-sm flex gap-2" style={{ color: "var(--k-text-muted)" }}>
                  <span>✅</span><span>{s}</span>
                </p>
              ))}
            </div>
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <h3 className="text-sm font-semibold text-orange-400">Improvements Needed</h3>
              {result.improvements?.map((imp, i) => (
                <p key={i} className="text-sm flex gap-2" style={{ color: "var(--k-text-muted)" }}>
                  <span>⚠️</span><span>{imp}</span>
                </p>
              ))}
            </div>
          </div>

          {/* Policy flags */}
          {result.facebook_policy_flags?.length > 0 && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <h3 className="text-sm font-semibold text-red-400">Facebook Policy Flags</h3>
              {result.facebook_policy_flags.map((flag, i) => (
                <p key={i} className="text-sm flex gap-2" style={{ color: "var(--k-text-muted)" }}>
                  <span>🚫</span><span>{flag}</span>
                </p>
              ))}
            </div>
          )}

          <a href="https://www.facebook.com/business/ads-guide" target="_blank" rel="noreferrer"
             className="block text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
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
        <h1 className="text-2xl font-bold" style={{ color: "var(--k-text)", letterSpacing: "-0.02em" }}>Creatives</h1>
        <p className="text-sm mt-1" style={{ color: "var(--k-text-muted)" }}>AI-powered copy generation and creative auditing</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--k-bg2)", border: "1px solid var(--k-card-border)" }}>
        {[
          { key: "copy",  label: "Copy Generator" },
          { key: "audit", label: "Creative Audit"  },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={tab === key
              ? { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }
              : { color: "var(--k-text-muted)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "copy"  && <CopyGeneratorTab />}
      {tab === "audit" && <CreativeAuditTab />}
    </div>
  );
}
