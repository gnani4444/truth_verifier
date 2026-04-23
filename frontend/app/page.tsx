"use client";

import { useState, useCallback, useEffect } from "react";
import UrlInput from "@/components/UrlInput";
import MediaPreview from "@/components/MediaPreview";
import ClaimsList from "@/components/ClaimsList";
import Navbar from "@/components/Navbar";
import UsageBanner from "@/components/UsageBanner";
import UpgradeModal from "@/components/UpgradeModal";
import { postVerify, getMediaUrl, streamResults } from "@/lib/api";
import type { ClaimResult } from "@/lib/api";
import type { ClaimState, SseEvent } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface UsageInfo {
  used: number;
  limit: number | null;
  tier: string | null;
}

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo>({ used: 0, limit: null, tier: null });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [visionRequired, setVisionRequired] = useState(false);
  const [lastUrl, setLastUrl] = useState("");
  const [lastUseVision, setLastUseVision] = useState(false);
  const [mediaType, setMediaType] = useState<"video" | "image" | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimState[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    fetch("/api/profile/usage")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setUsage({ used: d.used, limit: d.limit, tier: d.tier });
        }
      })
      .catch(() => {});
  }, []);

  const refreshUsage = useCallback(() => {
    fetch("/api/profile/usage")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setUsage({ used: d.used, limit: d.limit, tier: d.tier });
        }
      })
      .catch(() => {});
  }, []);

  const handleVerify = useCallback(
    async (url: string, useVision: boolean, forceRefresh: boolean = false) => {
      setLoading(true);
      setError("");
      setVisionRequired(false);
      setLastUrl(url);
      setLastUseVision(useVision);
      setStatus("Connecting to server...");
      setClaims([]);
      setExtractedText(null);
      setMediaUrl(null);
      setMediaType(null);
      setDownloadUrl(null);

      let cleanup: (() => void) | null = null;

      try {
        const { jobId, claims: cachedClaims, extractedText: cachedText } =
          await postVerify(url, useVision, forceRefresh);

        if (cachedClaims !== null) {
          const doneStates: ClaimState[] = cachedClaims.map((c: ClaimResult) => ({
            text: c.text,
            status: "done",
            verdict: c.verdict,
            explanation: c.explanation,
            source: c.source,
          }));
          setClaims(doneStates);
          if (cachedText !== null) setExtractedText(cachedText);
          setStatus("");
          setLoading(false);
          refreshUsage();
          return;
        }

        if (jobId !== null) {
          cleanup = streamResults(
            jobId,
            url,
            useVision,
            (event: SseEvent) => {
              if (event.type === "status") {
                setStatus(event.message);
              } else if (event.type === "media") {
                const mediaUrlValue = getMediaUrl(jobId);
                setMediaUrl(mediaUrlValue);
                setDownloadUrl(mediaUrlValue);
                setMediaType(event.media_type);
              } else if (event.type === "text") {
                setExtractedText(event.content);
              } else if (event.type === "claim") {
                setClaims((prev) => [...prev, { text: event.text, status: "checking" }]);
              } else if (event.type === "result") {
                setClaims((prev) =>
                  prev.map((c) =>
                    c.text === event.text
                      ? {
                          text: event.text,
                          status: "done",
                          verdict: event.verdict,
                          explanation: event.explanation,
                          source: event.source,
                        }
                      : c
                  )
                );
              } else if (event.type === "done") {
                setStatus("");
                setLoading(false);
                cleanup?.();
                refreshUsage();
              } else if (event.type === "error") {
                setError(event.message);
                setVisionRequired(event.vision_required === true);
                setStatus("");
                setLoading(false);
                cleanup?.();
              }
            },
            (err) => {
              setError(err.message);
              setStatus("");
              setLoading(false);
            }
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to connect to server. Is it running?";
        if (msg.toLowerCase().includes("daily limit")) {
          setShowUpgrade(true);
        }
        setError(msg);
        setStatus("");
        setLoading(false);
      }
    },
    [refreshUsage]
  );

  const hasResults = extractedText !== null || claims.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar email={userEmail} tier={usage.tier} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
          <div className="relative max-w-3xl mx-auto px-6 py-16 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium mb-6 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Powered by AI — cross-referenced against trusted sources
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
              Fact-check Instagram<br className="hidden sm:block" /> in seconds
            </h1>
            <p className="text-blue-100 text-lg max-w-xl mx-auto leading-relaxed">
              Paste any public Instagram post or reel URL. Truth Verifier extracts
              every claim and cross-references it against trusted sources.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {[
                { icon: "📥", label: "Extract claims" },
                { icon: "🔍", label: "Verify with AI" },
                { icon: "✅", label: "Instant verdict" },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium"
                >
                  <span>{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Usage banner for free users */}
          {usage.tier === "free" && usage.limit !== null && (
            <UsageBanner
              used={usage.used}
              limit={usage.limit}
              onUpgrade={() => setShowUpgrade(true)}
            />
          )}

          {/* URL input */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 flex items-end gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Instagram URL
              </p>
              <UrlInput onVerify={handleVerify} loading={loading} showVision={usage.tier === "admin"} />
            </div>
            {hasResults && !loading && (
              <button
                onClick={() => handleVerify(lastUrl, lastUseVision, true)}
                className="shrink-0 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                title="Clear cache and re-run from scratch"
              >
                ↺ Refresh
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-4">
              <span>{error}</span>
              {visionRequired && usage.tier === "admin" && (
                <button
                  onClick={() => handleVerify(lastUrl, true)}
                  className="shrink-0 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Retry with Visual Analysis
                </button>
              )}
            </div>
          )}

          {/* Extracted text */}
          {extractedText && (
            <details className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer select-none flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Extracted Text
              </summary>
              <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed border-t border-gray-50 pt-3">
                {extractedText}
              </p>
            </details>
          )}

          {/* Results grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Media</h2>
              <MediaPreview
                mediaType={mediaType}
                mediaUrl={mediaUrl}
                downloadUrl={downloadUrl}
              />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 min-h-64">
              <ClaimsList claims={claims} status={status} />
            </div>
          </div>
        </div>
      </main>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
