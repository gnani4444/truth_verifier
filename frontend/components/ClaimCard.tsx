'use client';

import type { ClaimState } from '@/types';

interface Props {
  claim: ClaimState;
}

const VERDICT_STYLES = {
  TRUE: {
    badge: 'bg-green-100 text-green-800',
    border: 'border-green-200 bg-green-50',
    label: '✅ TRUE',
  },
  FALSE: {
    badge: 'bg-red-100 text-red-800',
    border: 'border-red-200 bg-red-50',
    label: '❌ FALSE',
  },
  UNVERIFIABLE: {
    badge: 'bg-yellow-100 text-yellow-800',
    border: 'border-yellow-200 bg-yellow-50',
    label: '⚠️ UNVERIFIABLE',
  },
} as const;

export default function ClaimCard({ claim }: Props) {
  if (claim.status === 'checking') {
    return (
      <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-2">
        <span className="animate-spin inline-block">⏳</span>
        <p className="text-gray-600 text-sm truncate">{claim.text}</p>
      </div>
    );
  }

  const style = VERDICT_STYLES[claim.verdict!];

  return (
    <div className={`p-3 rounded-lg border ${style.border}`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <p className="text-gray-800 text-sm mt-2">&quot;{claim.text}&quot;</p>
      {claim.explanation && (
        <p className="text-gray-500 text-xs mt-1">{claim.explanation}</p>
      )}
      {claim.source && (
        <a
          href={claim.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 text-xs hover:underline block mt-1 truncate"
        >
          {claim.source}
        </a>
      )}
    </div>
  );
}
