interface UsageBannerProps {
  used: number;
  limit: number;
  onUpgrade: () => void;
}

export default function UsageBanner({ used, limit, onUpgrade }: UsageBannerProps) {
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, (used / limit) * 100);
  const isExhausted = remaining === 0;

  return (
    <div
      className={`rounded-xl p-4 ${
        isExhausted
          ? "bg-red-50 border border-red-200"
          : "bg-blue-50 border border-blue-100"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {isExhausted
            ? "Daily limit reached — 0 verifications remaining"
            : `${remaining} of ${limit} free verifications remaining today`}
        </span>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          Upgrade to Pro →
        </button>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isExhausted ? "bg-red-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
