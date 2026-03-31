// Kampaign.ai — AI-native campaign engine — CampaignTable component

const STATUS_BADGE = {
  active:   "bg-green-900 text-green-300",
  paused:   "bg-yellow-900 text-yellow-300",
  draft:    "bg-gray-700 text-gray-300",
  archived: "bg-red-900 text-red-300",
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
      <p className="text-gray-500 text-sm">
        No campaigns yet — create one on the Launch page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase bg-gray-900">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Objective</th>
            <th className="px-4 py-3">Daily Budget</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="border-b border-gray-800 hover:bg-gray-800/60 transition-colors group"
            >
              {/* Clicking name/cells → open Ads Manager */}
              <td
                className="px-4 py-3 font-medium text-white group-hover:text-indigo-300 transition-colors cursor-pointer"
                onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                title="Open in Facebook Ads Manager"
              >
                {c.name}
              </td>
              <td
                className="px-4 py-3 text-gray-300 cursor-pointer"
                onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
              >
                {c.objective
                  ? c.objective.replace(/^OUTCOME_/, "").replace(/_/g, " ")
                  : "—"}
              </td>
              <td
                className="px-4 py-3 text-gray-300 cursor-pointer"
                onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
              >
                {/* FIX 5 — ₹ INR */}
                {c.daily_budget != null ? `₹${c.daily_budget.toLocaleString("en-IN")}` : "—"}
              </td>
              <td
                className="px-4 py-3 cursor-pointer"
                onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
              >
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    STATUS_BADGE[c.status] ?? STATUS_BADGE.draft
                  }`}
                >
                  {c.status}
                </span>
              </td>
              <td
                className="px-4 py-3 text-gray-400 cursor-pointer"
                onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
              >
                {new Date(c.created_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </td>

              {/* Action column — external link + delete (FIX 3+4) */}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* External link */}
                  <button
                    onClick={() => window.open(fbAdsManagerUrl(c), "_blank", "noopener,noreferrer")}
                    title="Open in Facebook Ads Manager"
                    className="text-gray-500 hover:text-indigo-400 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(c.id, c.name); }}
                      title="Delete from Kampaign.ai"
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
