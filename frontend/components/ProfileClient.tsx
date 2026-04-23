"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import UsageBanner from "@/components/UsageBanner";
import UpgradeModal from "@/components/UpgradeModal";
import StatsCards from "@/components/profile/StatsCards";
import UsageChart from "@/components/profile/UsageChart";
import VerificationHistory from "@/components/profile/VerificationHistory";
import ChangePassword from "@/components/profile/ChangePassword";

interface HistoryItem {
  id: string;
  url: string;
  use_vision: boolean;
  created_at: string;
  claim_count: number;
  verdicts: Record<string, number>;
}

interface Stats {
  total: number;
  today: number;
  week: number;
  verdicts: { TRUE: number; FALSE: number; UNVERIFIABLE: number };
  daily: Record<string, number>;
}

interface ProfileClientProps {
  email: string;
  tier: string;
  memberSince: string;
  used: number;
  limit: number | null;
}

type Tab = "overview" | "history" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

const TIER_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  pro: "bg-green-100 text-green-700 border-green-200",
  free: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function ProfileClient({
  email,
  tier,
  memberSince,
  used,
  limit,
}: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profile/stats")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "history" && history.length === 0) {
      setHistoryLoading(true);
      fetch("/api/profile/history")
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setHistory(d.history);
        })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab, history.length]);

  const tierClass = TIER_COLORS[tier] ?? TIER_COLORS.free;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900 tracking-tight">
            Truth Verifier
          </Link>
          <span className="text-sm text-gray-400">Profile</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Profile header card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-900 truncate">{email}</p>
              <p className="text-sm text-gray-400">Member since {memberSince}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${tierClass}`}>
              {tier.toUpperCase()}
            </span>
          </div>

          {tier === "free" && limit !== null && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <UsageBanner
                used={used}
                limit={limit}
                onUpgrade={() => setShowUpgrade(true)}
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview tab */}
            {activeTab === "overview" && (
              <div className="space-y-8">
                {statsLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse h-24" />
                    ))}
                  </div>
                ) : stats ? (
                  <>
                    <StatsCards
                      total={stats.total}
                      today={stats.today}
                      week={stats.week}
                      verdicts={stats.verdicts}
                    />
                    <UsageChart daily={stats.daily} />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Verdict Breakdown</h3>
                      <div className="flex gap-4">
                        {(["TRUE", "FALSE", "UNVERIFIABLE"] as const).map((v) => {
                          const count = stats.verdicts[v];
                          const total = stats.verdicts.TRUE + stats.verdicts.FALSE + stats.verdicts.UNVERIFIABLE;
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          const colors = {
                            TRUE: "bg-green-500",
                            FALSE: "bg-red-500",
                            UNVERIFIABLE: "bg-yellow-400",
                          };
                          const labels = { TRUE: "True", FALSE: "False", UNVERIFIABLE: "Unverifiable" };
                          return (
                            <div key={v} className="flex-1 text-center">
                              <div className="text-2xl font-bold text-gray-800">{count}</div>
                              <div className={`h-1.5 rounded-full mt-1 mb-1 ${colors[v]}`} style={{ width: `${pct}%`, minWidth: count > 0 ? "8px" : "0" }} />
                              <div className="text-xs text-gray-400">{labels[v]}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">Could not load stats.</p>
                )}

                {tier === "free" && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Upgrade to Pro</p>
                      <p className="text-xs text-gray-500 mt-0.5">Unlimited daily verifications</p>
                    </div>
                    <button
                      onClick={() => setShowUpgrade(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shrink-0"
                    >
                      Upgrade →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {activeTab === "history" && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Verifications</h2>
                {historyLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <VerificationHistory history={history} />
                )}
              </div>
            )}

            {/* Settings tab */}
            {activeTab === "settings" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Account</h2>
                  <p className="text-sm text-gray-400 mb-4">Signed in as {email}</p>
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                      <span className="text-sm text-gray-600">Email</span>
                      <span className="text-sm font-medium text-gray-900">{email}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                      <span className="text-sm text-gray-600">Plan</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${tierClass}`}>
                        {tier.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                      <span className="text-sm text-gray-600">Member since</span>
                      <span className="text-sm text-gray-900">{memberSince}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
                  <ChangePassword />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
