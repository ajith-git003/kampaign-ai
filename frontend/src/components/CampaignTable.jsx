// Kampaign.ai — CampaignTable component

const STATUS_STYLES = {
  active:   { bg: "rgba(16,185,129,0.12)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  paused:   { bg: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
  draft:    { bg: "rgba(107,114,128,0.12)", color: "#9ca3af", border: "rgba(107,114,128,0.3)" },
  archived: { bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.3)" },
};

function fbAdsManagerUrl(campaign) {
  if (campaign.meta_campaign_id) {
    return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.meta_campaign_id}`;
  }
  return "https://adsmanager.facebook.com/adsmanager/manage/campaigns";
}

export default function CampaignTable({ campaigns, onDelete }) {
  if (!campaigns.length) {
    return (
      <p className="text-sm" style={{ color: "var(--k-text-muted)" }}>
        No campaigns yet. Campaigns launched via Facebook Ads Manager will appear here after syncing.
      </p>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--k-card-border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr
              className="text-xs uppercase"
              style={{
                background: "var(--k-bg2)",
                color: "var(--k-text-muted)",
                borderBottom: "1px solid var(--k-divider)",
              }}
            >
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Objective</th>
              <th className="px-4 py-3 font-medium">Daily Budget</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const st = STATUS_STYLES[c.status] ?? STATUS_STYLES.draft;
              return (
                <tr
                  key={c.id}
                  className="group transition-colors"
                  style={{ borderBottom: "1px solid var(--k-divider)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--k-table-row)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td
                    className="px-4 py-3 font-medium cursor-pointer transition-colors"
                    style={{ color: "var(--k-text)" }}
                    onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                  >
                    {c.name}
                  </td>
                  <td
                    className="px-4 py-3 cursor-pointer"
                    style={{ color: "var(--k-text-muted)" }}
                    onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                  >
                    {c.objective ? c.objective.replace(/^OUTCOME_/, "").replace(/_/g, " ") : "—"}
                  </td>
                  <td
                    className="px-4 py-3 cursor-pointer tabular-nums"
                    style={{ color: "var(--k-text-muted)" }}
                    onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                  >
                    {c.daily_budget != null ? `₹${c.daily_budget.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                  >
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 cursor-pointer text-xs"
                    style={{ color: "var(--k-text-faint)" }}
                    onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                  >
                    {new Date(c.created_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                        title="Open in Facebook Ads Manager"
                        style={{ color: "var(--k-text-faint)" }}
                        className="hover:text-indigo-400 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                      </button>
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(c.id, c.name); }}
                          title="Delete from Kampaign.ai"
                          style={{ color: "var(--k-text-faint)" }}
                          className="hover:text-red-400 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
