"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  totalUsers: number;
  usersByTier: {
    free: number;
    pro: number;
    admin: number;
  };
  totalVerifications: number;
  verificationsToday: number;
  verificationsThisWeek: number;
  uniqueLinksVerified: number;
  topUrls: Array<{ url: string; count: number }>;
  newUsersToday: number;
  newUsersThisWeek: number;
  visionUsageCount: number;
}

interface MetricCardProps {
  value: number;
  label: string;
  sub?: string;
}

function MetricCard({ value, label, sub }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `Request failed with status ${res.status}`);
        }
        return res.json() as Promise<AnalyticsData>;
      })
      .then((json) => {
        setData(json);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-400 animate-pulse">
        Loading analytics…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-16 text-center text-sm text-red-500">
        Failed to load analytics: {error ?? "Unknown error"}
      </div>
    );
  }

  const cards: MetricCardProps[] = [
    { value: data.totalUsers, label: "Total Users", sub: "registered accounts" },
    {
      value: data.verificationsToday,
      label: "Verifications Today",
      sub: "resets at midnight UTC",
    },
    { value: data.verificationsThisWeek, label: "Verifications This Week" },
    { value: data.totalVerifications, label: "Total Verifications" },
    {
      value: data.uniqueLinksVerified,
      label: "Unique Links",
      sub: "distinct Instagram URLs",
    },
    {
      value: data.visionUsageCount,
      label: "Vision Analysis Used",
      sub: "posts with visual AI",
    },
    { value: data.newUsersToday, label: "New Users Today" },
    { value: data.newUsersThisWeek, label: "New Users This Week" },
  ];

  return (
    <div>
      {/* Metric cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="flex gap-4">
        <span className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">
          Free: {data.usersByTier.free}
        </span>
        <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm">
          Pro: {data.usersByTier.pro}
        </span>
        <span className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-sm">
          Admin: {data.usersByTier.admin}
        </span>
      </div>

      {/* Top 5 URLs table */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-6">
        Most Verified Links
      </h3>
      {data.topUrls.length === 0 ? (
        <p className="text-sm text-gray-400">No verifications yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="py-2 pr-4 font-semibold text-gray-600 w-10">Rank</th>
              <th className="py-2 pr-4 font-semibold text-gray-600">URL</th>
              <th className="py-2 font-semibold text-gray-600 text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.topUrls.map((item, idx) => {
              const display =
                item.url.length > 60 ? item.url.slice(0, 60) + "…" : item.url;
              return (
                <tr key={item.url} className="border-b border-gray-50 py-2">
                  <td className="py-2 pr-4 text-gray-400">{idx + 1}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {display}
                    </a>
                  </td>
                  <td className="py-2 text-right text-gray-700 font-medium">
                    {item.count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
