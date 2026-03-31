// Kampaign.ai — AI-native campaign engine — Toast notification component
import { useEffect, useState } from "react";

/**
 * Single toast notification. Auto-dismisses after `duration` ms.
 * @param {Object}   props
 * @param {string}   props.id
 * @param {string}   props.message
 * @param {"success"|"error"|"info"} props.type
 * @param {number}   props.duration   ms before auto-dismiss (default 4000)
 * @param {Function} props.onRemove   called when toast should be removed
 */
function Toast({ id, message, type = "info", duration = 4000, onRemove }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => onRemove(id), 300); // wait for fade-out
      return () => clearTimeout(t);
    }
  }, [visible, id, onRemove]);

  const colors = {
    success: "bg-green-900/90 border-green-600 text-green-200",
    error:   "bg-red-900/90 border-red-600 text-red-200",
    info:    "bg-[#1e2235] border-indigo-600/60 text-gray-200",
  };

  const icons = {
    success: "✓",
    error:   "✕",
    info:    "ℹ",
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border text-sm shadow-xl
        transition-all duration-300
        ${colors[type]}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      <span className="font-bold mt-0.5 shrink-0">{icons[type]}</span>
      <p className="leading-snug">{message}</p>
      <button
        onClick={() => setVisible(false)}
        className="ml-auto shrink-0 opacity-50 hover:opacity-100 text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * ToastContainer — renders all active toasts in a fixed bottom-right stack.
 * Usage: place once in layout or page, pass `toasts` array and `removeToast` callback.
 */
export function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onRemove={removeToast} />
      ))}
    </div>
  );
}

/**
 * useToasts — hook that manages toast state.
 * Returns { toasts, addToast, removeToast }
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  function addToast(message, type = "info", duration = 4000) {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, addToast, removeToast };
}
