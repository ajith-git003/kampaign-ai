// Kampaign.ai — AI-native campaign engine — InsightCard component

const SEVERITY_STYLES = {
  info:     "border-blue-700/50 bg-blue-900/10",
  warning:  "border-yellow-600/50 bg-yellow-900/10",
  critical: "border-red-600/50 bg-red-900/10",
};

const SEVERITY_BADGE = {
  info:     "bg-blue-900 text-blue-300",
  warning:  "bg-yellow-900 text-yellow-300",
  critical: "bg-red-900 text-red-300",
};

// Metric tag color mapping
const METRIC_COLORS = {
  ROAS:       "bg-purple-900/60 text-purple-300",
  CTR:        "bg-blue-900/60 text-blue-300",
  CPC:        "bg-cyan-900/60 text-cyan-300",
  SPEND:      "bg-orange-900/60 text-orange-300",
  BUDGET:     "bg-green-900/60 text-green-300",
  CONVERSION: "bg-pink-900/60 text-pink-300",
  PURCHASE:   "bg-pink-900/60 text-pink-300",
  CPM:        "bg-indigo-900/60 text-indigo-300",
};

function getMetricColor(tag) {
  const upper = tag.toUpperCase();
  for (const [key, cls] of Object.entries(METRIC_COLORS)) {
    if (upper.includes(key)) return cls;
  }
  return "bg-gray-800 text-gray-300";
}

/**
 * Parse GPT insight text into structured items.
 * Handles numbered list: "1. [METRIC] Issue: ... Action: ... Expected impact: ..."
 * Also handles plain text fallback.
 */
function parseInsightText(text) {
  if (!text) return [];

  // Split on numbered items: "1.", "2.", etc.
  const numbered = text.split(/\n?(?=\d+\.\s)/);
  const items = numbered.filter((s) => s.trim().length > 0);

  if (items.length <= 1) {
    // No numbered list — return as single paragraph
    return [{ raw: text, metric: null, issue: null, action: null, impact: null }];
  }

  return items.map((item) => {
    // Extract [METRIC] tag
    const metricMatch = item.match(/\[([^\]]+)\]/);
    const metric = metricMatch ? metricMatch[1] : null;

    // Extract Issue / Action / Expected impact
    const issueMatch  = item.match(/Issue:\s*([^]*?)(?=Action:|Expected impact:|$)/i);
    const actionMatch = item.match(/Action:\s*([^]*?)(?=Expected impact:|Issue:|$)/i);
    const impactMatch = item.match(/Expected impact:\s*([^]*?)(?=\d+\.|$)/i);

    const clean = (s) => s?.replace(/^\s+|\s+$/g, "").replace(/\n+/g, " ") || null;

    if (issueMatch || actionMatch || impactMatch) {
      return {
        raw:    item,
        metric: metric,
        issue:  clean(issueMatch?.[1]),
        action: clean(actionMatch?.[1]),
        impact: clean(impactMatch?.[1]),
      };
    }

    // Fallback: metric + raw text
    const rawText = item.replace(/^\d+\.\s*/, "").replace(/\[[^\]]+\]\s*/, "").trim();
    return { raw: rawText, metric, issue: null, action: null, impact: null };
  });
}


function StructuredRecommendation({ item }) {
  return (
    <div className="bg-[#141622] rounded-lg p-3 space-y-2 border border-gray-800">
      {item.metric && (
        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${getMetricColor(item.metric)}`}>
          [{item.metric}]
        </span>
      )}

      {item.issue && (
        <div className="flex gap-2 text-sm">
          <span className="text-gray-500 text-xs uppercase tracking-wide shrink-0 w-14 pt-0.5">Issue</span>
          <span className="text-gray-200">{item.issue}</span>
        </div>
      )}

      {item.action && (
        <div className="flex gap-2 text-sm">
          <span className="text-gray-500 text-xs uppercase tracking-wide shrink-0 w-14 pt-0.5">Action</span>
          <span className="text-gray-300">{item.action}</span>
        </div>
      )}

      {item.impact && (
        <div className="flex gap-2 text-sm">
          <span className="text-gray-500 text-xs uppercase tracking-wide shrink-0 w-14 pt-0.5">Impact</span>
          <span className="text-green-300/80">{item.impact}</span>
        </div>
      )}

      {/* Fallback — couldn't parse structured fields */}
      {!item.issue && !item.action && !item.impact && item.raw && (
        <p className="text-sm text-gray-300 leading-relaxed">{item.raw}</p>
      )}
    </div>
  );
}


export default function InsightCard({ insight }) {
  const containerStyle = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
  const badgeStyle     = SEVERITY_BADGE[insight.severity]  ?? SEVERITY_BADGE.info;
  const items          = parseInsightText(insight.content);

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${containerStyle}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${badgeStyle}`}>
            {insight.severity}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {insight.insight_type.replace(/_/g, " ")}
          </span>
        </div>
        <span className="text-xs text-gray-600">
          {new Date(insight.created_at).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </span>
      </div>

      {/* Structured recommendations */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <StructuredRecommendation key={i} item={item} />
        ))}
      </div>

      {insight.acknowledged && (
        <p className="text-xs text-gray-600">✓ Acknowledged</p>
      )}
    </div>
  );
}
