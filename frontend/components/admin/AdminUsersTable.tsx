'use client';

import { useState, useCallback } from 'react';
import type { UserProfile } from '@/app/admin/page';

type Tier = 'free' | 'pro' | 'admin';

interface RowState {
  tier: Tier;
  saving: boolean;
  message: string | null;
  isError: boolean;
}

interface Props {
  users: UserProfile[];
}

export default function AdminUsersTable({ users }: Props) {
  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    users.forEach((u) => {
      initial[u.id] = {
        tier: (u.tier as Tier) ?? 'free',
        saving: false,
        message: null,
        isError: false,
      };
    });
    return initial;
  });

  const handleTierChange = useCallback(
    async (userId: string, newTier: Tier) => {
      setRowStates((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], tier: newTier, saving: true, message: null },
      }));

      try {
        const res = await fetch('/api/admin/update-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, tier: newTier }),
        });

        const json = await res.json();

        if (!res.ok) {
          setRowStates((prev) => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              saving: false,
              message: json.error ?? 'Failed to update',
              isError: true,
            },
          }));
        } else {
          setRowStates((prev) => ({
            ...prev,
            [userId]: {
              ...prev[userId],
              saving: false,
              message: 'Saved',
              isError: false,
            },
          }));
          // Clear success message after 2 s
          setTimeout(() => {
            setRowStates((prev) => ({
              ...prev,
              [userId]: { ...prev[userId], message: null },
            }));
          }, 2000);
        }
      } catch {
        setRowStates((prev) => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            saving: false,
            message: 'Network error',
            isError: true,
          },
        }));
      }
    },
    []
  );

  if (users.length === 0) {
    return (
      <p className="p-6 text-sm text-gray-500 text-center">No users found.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Tier</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Joined</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Today</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, idx) => {
            const state = rowStates[user.id] ?? {
              tier: user.tier as Tier,
              saving: false,
              message: null,
              isError: false,
            };

            return (
              <tr
                key={user.id}
                className={`border-b border-gray-100 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                } hover:bg-blue-50/30 transition-colors`}
              >
                {/* Email */}
                <td className="px-4 py-3 text-gray-800 font-medium">
                  {user.email}
                </td>

                {/* Tier badge */}
                <td className="px-4 py-3">
                  <TierBadge tier={state.tier} />
                </td>

                {/* Joined date */}
                <td className="px-4 py-3 text-gray-500">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>

                {/* Verifications Today */}
                <td className="px-4 py-3 text-gray-600 text-center">{user.verifications_today}</td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={state.tier}
                      disabled={state.saving}
                      onChange={(e) =>
                        handleTierChange(user.id, e.target.value as Tier)
                      }
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="admin">admin</option>
                    </select>

                    {state.saving && (
                      <span className="text-xs text-gray-400 animate-pulse">
                        Saving…
                      </span>
                    )}
                    {!state.saving && state.message && (
                      <span
                        className={`text-xs font-medium ${
                          state.isError ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {state.message}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    admin:
      'bg-purple-100 text-purple-700 border border-purple-200',
    pro: 'bg-blue-100 text-blue-700 border border-blue-200',
    free: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  const cls = styles[tier] ?? styles.free;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {tier}
    </span>
  );
}
