interface StatsCardsProps {
  total: number;
  today: number;
  week: number;
  verdicts: { TRUE: number; FALSE: number; UNVERIFIABLE: number };
}

export default function StatsCards({ total, today, week, verdicts }: StatsCardsProps) {
  const totalClaims = verdicts.TRUE + verdicts.FALSE + verdicts.UNVERIFIABLE;

  const cards = [
    { label: "Total Verifications", value: total, sub: "all time", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Today", value: today, sub: "verifications", color: "text-green-600", bg: "bg-green-50" },
    { label: "This Week", value: week, sub: "verifications", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Claims Checked", value: totalClaims, sub: "last 7 days", color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`${card.bg} rounded-xl p-4`}>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
          <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
