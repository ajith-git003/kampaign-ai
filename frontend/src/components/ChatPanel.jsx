// Kampaign.ai — AI-native campaign engine — Conversational Campaign Intelligence
import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const SUGGESTION_PILLS = [
  "Why is Video Views underperforming?",
  "Which campaign should I scale?",
  "Where is my budget being wasted?",
  "Compare my top 3 campaigns",
];

// ── Single message bubble ─────────────────────────────────────────────────────

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function AiBubble({ message, onActionClick }) {
  if (message.loading) {
    return (
      <div className="flex gap-2 items-center text-sm text-gray-400 px-1">
        <svg className="w-4 h-4 animate-spin shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Analysing campaign data…
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-300">
        {message.error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Answer card */}
      <div className="bg-[#1e2235] border border-gray-700/50 rounded-xl px-4 py-3 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Kampaign.ai</span>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{message.answer}</p>

        {/* Data citations */}
        {message.data_used?.length > 0 && (
          <p className="text-xs text-gray-600 mt-1 pt-1 border-t border-gray-700/50">
            Based on: {message.data_used.join(" · ")}
          </p>
        )}
      </div>

      {/* Suggested action chips */}
      {message.suggested_actions?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {message.suggested_actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onActionClick?.(action)}
              className="text-xs bg-[#141622] border border-indigo-700/50 text-indigo-300
                         hover:border-indigo-500 hover:text-indigo-200 rounded-full px-3 py-1
                         transition-colors text-left"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

/**
 * ChatPanel — conversational campaign intelligence.
 *
 * Props:
 *   campaigns  {array}    — list from /api/campaigns/ for the campaign selector
 *   onClose    {Function} — called when panel is closed
 */
export default function ChatPanel({ campaigns = [], onClose }) {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [selectedCampaign, setSelected] = useState("");
  const [loading, setLoading]           = useState(false);
  const bottomRef                       = useRef(null);
  const inputRef                        = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage(text) {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput("");

    // Add user bubble
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    // Add loading AI bubble
    const loadingId = Date.now();
    setMessages((prev) => [...prev, { role: "ai", id: loadingId, loading: true }]);

    try {
      const res = await fetch(`${API}/api/chat/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          campaign_name: selectedCampaign || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `API error ${res.status}`);
      }
      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { role: "ai", id: loadingId, ...data }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { role: "ai", id: loadingId, error: err.message }
            : m
        )
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Suggested action chip clicked — send as follow-up question
  function handleActionChipClick(actionText) {
    sendMessage(`How do I: ${actionText}`);
  }

  const campaignNames = [...new Set(
    campaigns
      .map((c) => c.name)
      .filter(Boolean)
  )];

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="relative w-full max-w-md bg-[#13151f] border-l border-gray-800 flex flex-col pointer-events-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-semibold text-white text-sm">Ask Kampaign.ai</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Campaign selector */}
        <div className="px-4 py-2 border-b border-gray-800/60">
          <select
            className="w-full bg-[#1e2235] border border-gray-700 rounded-md px-3 py-1.5
                       text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
            value={selectedCampaign}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">All campaigns</option>
            {campaignNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 text-center">
                Ask anything about your campaign performance
              </p>
              <div className="space-y-2">
                {SUGGESTION_PILLS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left text-sm text-gray-400 hover:text-gray-200
                               bg-[#1e2235] hover:bg-[#252840] border border-gray-700/50
                               rounded-lg px-4 py-2.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <UserBubble key={i} text={msg.text} />
            ) : (
              <AiBubble key={i} message={msg} onActionClick={handleActionChipClick} />
            )
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 bg-[#1e2235] border border-gray-700 rounded-xl px-3 py-2.5
                         text-sm text-gray-200 placeholder-gray-600 resize-none
                         focus:outline-none focus:border-indigo-500 leading-relaxed"
              placeholder="Ask about your campaigns…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl
                         bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-1.5 text-center">
            Powered by GPT-4o-mini · Kampaign.ai
          </p>
        </div>
      </div>
    </div>
  );
}
