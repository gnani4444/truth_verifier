"use client";

import { useState } from "react";

interface HistoryItem {
  id: string;
  url: string;
  use_vision: boolean;
  created_at: string;
  claim_count: number;
  verdicts: Record<string, number>;
}

interface VerificationHistoryProps {
  history: HistoryItem[];
}

const VERDICT_COLORS: Record<string, string> = {
  TRUE: "bg-green-100 text-green-700",
  FALSE: "bg-red-100 text-red-700",
  UNVERIFIABLE: "bg-yellow-100 text-yellow-700",
};

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    const short = path.split("/").slice(-2).join("/");
    return short || u.hostname;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "…" : url;
  }
}

export default function VerificationHistory({ history }: VerificationHistoryProps) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const pages = Math.ceil(history.length / pageSize);
  const slice = history.slice(page * pageSize, (page + 1) * pageSize);

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No verifications yet. Paste an Instagram URL on the home page to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {slice.map((item) => {
        const date = new Date(item.created_at).toLocaleDateString("en-US", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
        const verdictEntries = Object.entries(item.verdicts).filter(([, v]) => v > 0);
        return (
          <div key={item.id} className="bg-gray-50 rounded-xl p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline truncate block"
                title={item.url}
              >
                {truncateUrl(item.url)}
              </a>
              <p className="text-xs text-gray-400 mt-0.5">{date}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.use_vision && (
                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                  Vision
                </span>
              )}
              {verdictEntries.map(([verdict, count]) => (
                <span
                  key={verdict}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${VERDICT_COLORS[verdict] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {count} {verdict === "UNVERIFIABLE" ? "?" : verdict === "TRUE" ? "✓" : "✗"}
                </span>
              ))}
              {item.claim_count === 0 && (
                <span className="text-xs text-gray-400">{item.claim_count} claims</span>
              )}
            </div>
          </div>
        );
      })}

      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">{page + 1} / {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
