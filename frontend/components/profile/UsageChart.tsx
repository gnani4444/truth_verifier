interface UsageChartProps {
  daily: Record<string, number>;
}

export default function UsageChart({ daily }: UsageChartProps) {
  const entries = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Verifications (Last 7 Days)</h3>
      <div className="flex items-end gap-2 h-24">
        {entries.map(([date, count]) => {
          const pct = Math.round((count / max) * 100);
          const day = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
            weekday: "short",
            timeZone: "UTC",
          });
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-600">{count > 0 ? count : ""}</span>
              <div className="w-full flex items-end" style={{ height: "64px" }}>
                <div
                  className="w-full rounded-t-md bg-blue-500 transition-all"
                  style={{ height: `${Math.max(pct, count > 0 ? 8 : 2)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
