'use client';

import ClaimCard from './ClaimCard';
import type { ClaimState } from '@/types';

interface Props {
  claims: ClaimState[];
  status: string;
}

export default function ClaimsList({ claims, status }: Props) {
  const isEmpty = claims.length === 0 && !status;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-3">Extracted Claims</h2>

      {status && (
        <p className="text-sm text-gray-400 italic mb-3">{status}</p>
      )}

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-300 text-sm">Claims will appear here as they&apos;re verified</p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {claims.map((claim, i) => (
            <ClaimCard key={i} claim={claim} />
          ))}
        </div>
      )}
    </div>
  );
}
