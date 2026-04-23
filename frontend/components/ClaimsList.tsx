"use client";

import ClaimCard from "./ClaimCard";
import type { ClaimState } from "@/types";

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
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-gray-400 italic">{status}</p>
        </div>
      )}

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
          <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-300 text-sm text-center">
            Claims will appear here as they&apos;re verified
          </p>
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
