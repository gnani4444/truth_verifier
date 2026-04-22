'use client';

import { Fragment, useState, useCallback, useTransition } from 'react';
import type { AdminLog, LogClaim } from '@/app/admin/page';

const isSafeUrl = (url: string) =>
  url.startsWith('https://') || url.startsWith('http://');

const PAGE_SIZE = 20;

interface Props {
  initialLogs: AdminLog[];
  initialTotal: number;
}

interface Filters {
  user: string;
  from: string;
  to: string;
}

export default function AdminLogsTable({ initialLogs, initialTotal }: Props) {
  const [logs, setLogs] = useState<AdminLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ user: '', from: '', to: '' });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLogs = useCallback(
    async (newPage: number, newFilters: Filters) => {
      setFetchError(null);
      const params = new URLSearchParams({ page: String(newPage) });
      if (newFilters.user) params.set('user', newFilters.user);
      if (newFilters.from) params.set('from', newFilters.from);
      if (newFilters.to) params.set('to', newFilters.to);

      try {
        const res = await fetch(`/api/admin/logs?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          setFetchError(json.error ?? 'Failed to load logs');
          return;
        }
        setLogs(json.logs ?? []);
        setTotal(json.total ?? 0);
        setPage(newPage);
      } catch {
        setFetchError('Network error fetching logs');
      }
    },
    []
  );

  const handleFilterChange = (field: keyof Filters, value: string) => {
    const updated = { ...filters, [field]: value };
    setFilters(updated);
    startTransition(() => {
      fetchLogs(1, updated);
    });
  };

  const handlePrev = () => {
    if (page > 1) {
      startTransition(() => {
        fetchLogs(page - 1, filters);
      });
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      startTransition(() => {
        fetchLogs(page + 1, filters);
      });
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Filter controls */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">User email</label>
          <input
            type="text"
            placeholder="Filter by email…"
            value={filters.user}
            onChange={(e) => handleFilterChange('user', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">From date</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => handleFilterChange('from', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">To date</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => handleFilterChange('to', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {isPending && (
          <span className="text-xs text-gray-400 animate-pulse self-end pb-1.5">
            Loading…
          </span>
        )}
      </div>

      {fetchError && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 text-red-700 text-sm">
          {fetchError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600 w-5" aria-label="Expand row"></th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">User Email</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">URL</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Timestamp</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Claims</th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Results</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No logs found.
                </td>
              </tr>
            )}
            {logs.map((log, idx) => {
              const isExpanded = expandedRows.has(log.id);
              const claimsCount = log.claims?.length ?? 0;

              return (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => claimsCount > 0 && toggleRow(log.id)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && claimsCount > 0) {
                        e.preventDefault();
                        toggleRow(log.id);
                      }
                    }}
                    tabIndex={claimsCount > 0 ? 0 : undefined}
                    aria-expanded={claimsCount > 0 ? isExpanded : undefined}
                    className={`border-b border-gray-100 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    } ${claimsCount > 0 ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}
                  >
                    {/* Expand toggle */}
                    <td className="px-4 py-3 text-gray-400 select-none">
                      {claimsCount > 0 && (
                        <span className="text-xs">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {log.user_email}
                    </td>

                    {/* URL truncated */}
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs max-w-xs">
                      {isSafeUrl(log.url) ? (
                        <a
                          href={log.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-blue-600 hover:underline"
                          title={log.url}
                        >
                          {log.url.length > 40 ? log.url.slice(0, 40) + '…' : log.url}
                        </a>
                      ) : (
                        <span title={log.url} className="text-gray-400">
                          {log.url.length > 40 ? log.url.slice(0, 40) + '…' : log.url}
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Claims count */}
                    <td className="px-4 py-3 text-gray-600 text-center">
                      {claimsCount}
                    </td>

                    {/* Verdict counts */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <span className="text-green-600" title="True">
                          ✅ {log.true_count}
                        </span>
                        <span className="text-red-500" title="False">
                          ❌ {log.false_count}
                        </span>
                        <span className="text-yellow-500" title="Unverifiable">
                          ⚠️ {log.unverifiable_count}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded claims */}
                  {isExpanded && claimsCount > 0 && (
                    <tr
                      className="bg-blue-50/20 border-b border-blue-100"
                    >
                      <td colSpan={6} className="px-6 py-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Claims breakdown
                          </p>
                          {(log.claims ?? []).map((claim, ci) => (
                            <ClaimRow key={`${log.id}-claim-${ci}`} claim={claim} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
        <span className="text-sm text-gray-500">
          Page {page} of {totalPages}{' '}
          <span className="text-gray-400">({total} total)</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={page <= 1 || isPending}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            ← Prev
          </button>
          <button
            onClick={handleNext}
            disabled={page >= totalPages || isPending}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    TRUE: {
      label: '✅ TRUE',
      cls: 'bg-green-100 text-green-700 border border-green-200',
    },
    FALSE: {
      label: '❌ FALSE',
      cls: 'bg-red-100 text-red-700 border border-red-200',
    },
    UNVERIFIABLE: {
      label: '⚠️ UNVERIFIABLE',
      cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    },
  };
  const { label, cls } = map[verdict] ?? {
    label: verdict,
    cls: 'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function ClaimRow({ claim }: { claim: LogClaim }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-800 flex-1">{claim.claim}</p>
        <VerdictBadge verdict={claim.verdict} />
      </div>
      {claim.explanation && (
        <p className="text-xs text-gray-600 leading-relaxed">{claim.explanation}</p>
      )}
      {claim.source && isSafeUrl(claim.source) && (
        <a
          href={claim.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline break-all"
        >
          {claim.source}
        </a>
      )}
    </div>
  );
}
