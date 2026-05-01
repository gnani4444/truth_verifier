"use client";

import { useState } from "react";
import AdminAnalytics from "./AdminAnalytics";
import AdminUsersTable from "./AdminUsersTable";
import AdminLogsTable from "./AdminLogsTable";
import type { UserProfile, AdminLog } from "@/app/admin/page";

interface Props {
  users: UserProfile[];
  initialLogs: AdminLog[];
  initialTotal: number;
}

const TABS = ["Analytics", "Users", "Logs"] as const;
type Tab = (typeof TABS)[number];

export default function AdminTabs({ users, initialLogs, initialTotal }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Analytics");

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6" aria-label="Admin tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === "Analytics" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <AdminAnalytics />
        </div>
      )}

      {activeTab === "Users" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <AdminUsersTable users={users} />
        </div>
      )}

      {activeTab === "Logs" && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <AdminLogsTable initialLogs={initialLogs} initialTotal={initialTotal} />
        </div>
      )}
    </div>
  );
}
