"use client";

import type { ClaimState } from "@/types";

interface Props {
  claim: ClaimState;
}

const VERDICT_CONFIG = {
  TRUE: {
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    label: "TRUE",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  FALSE: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "FALSE",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  UNVERIFIABLE: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    label: "UNVERIFIABLE",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
} as const;

export default function ClaimCard({ claim }: Props) {
  if (claim.status === "checking") {
    return (
      <div className="p-4 rounded-xl border border-gray-200 bg-white flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
        <p className="text-gray-500 text-sm truncate">{claim.text}</p>
      </div>
    );
  }

  const config = VERDICT_CONFIG[claim.verdict!];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${config.badge}`}>
          {config.icon}
          {config.label}
        </span>
      </div>
      <p className="text-gray-800 text-sm leading-relaxed">&quot;{claim.text}&quot;</p>
      {claim.explanation && (
        <p className="text-gray-500 text-xs leading-relaxed">{claim.explanation}</p>
      )}
      {claim.source && (
        <a
          href={claim.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 text-xs hover:text-blue-700 hover:underline block truncate"
        >
          {claim.source}
        </a>
      )}
    </div>
  );
}
