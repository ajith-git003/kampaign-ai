// Kampaign.ai — AI-native campaign engine — MetricCard component

export default function MetricCard({ label, value, delta, deltaLabel }) {
  const isPositive = typeof delta === "number" ? delta >= 0 : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {delta != null && (
        <p
          className={`text-xs font-medium ${
            isPositive ? "text-green-400" : "text-red-400"
          }`}
        >
          {isPositive ? "▲" : "▼"} {Math.abs(delta)}%{" "}
          {deltaLabel ?? "vs last period"}
        </p>
      )}
    </div>
  );
}
