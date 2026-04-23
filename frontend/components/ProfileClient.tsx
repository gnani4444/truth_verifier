"use client";

import Link from "next/link";
import { useState } from "react";
import UsageBanner from "@/components/UsageBanner";
import UpgradeModal from "@/components/UpgradeModal";

interface ProfileClientProps {
  email: string;
  tier: string;
  memberSince: string;
  used: number;
  limit: number | null;
}

export default function ProfileClient({
  email,
  tier,
  memberSince,
  used,
  limit,
}: ProfileClientProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const tierColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    pro: "bg-green-100 text-green-700",
    free: "bg-gray-100 text-gray-600",
  };
  const tierClass = tierColors[tier] ?? "bg-gray-100 text-gray-600";

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between py-4 px-6 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/" className="text-lg font-bold text-gray-900">
          Truth Verifier
        </Link>
        <span className="text-sm text-gray-500">Profile</span>
      </nav>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Your Profile</h1>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{email}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Plan</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierClass}`}
              >
                {tier.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Member since</span>
              <span className="text-sm text-gray-900">{memberSince}</span>
            </div>
          </div>
        </div>

        {tier === "free" && limit !== null && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Today&apos;s Usage
            </h2>
            <UsageBanner
              used={used}
              limit={limit}
              onUpgrade={() => setShowUpgrade(true)}
            />
          </div>
        )}

        {tier === "free" && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h2 className="text-base font-bold text-gray-900 mb-1">
              Upgrade to Pro
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Unlimited verifications per day, no daily caps.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Contact Admin to Upgrade
            </button>
          </div>
        )}
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </main>
  );
}
