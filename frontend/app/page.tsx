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
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
              Fact-check Instagram in seconds
            </h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Paste a public Instagram post or reel URL. Truth Verifier extracts
              every claim and cross-references it against trusted sources.
            </p>
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
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-end gap-3">
            <div className="flex-1">
              <UrlInput onVerify={handleVerify} loading={loading} />
            </div>
            {hasResults && !loading && (
              <button
                onClick={() => handleVerify(lastUrl, lastUseVision, true)}
                className="shrink-0 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                title="Clear cache and re-run from scratch"
              >
                ↺ Refresh
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-4">
              <span>{error}</span>
              {visionRequired && (
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
            <details className="bg-white rounded-xl shadow-sm p-4">
              <summary className="text-base font-semibold text-gray-800 cursor-pointer select-none">
                Extracted Text
              </summary>
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {extractedText}
              </p>
            </details>
          )}

          {/* Results grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Media</h2>
              <MediaPreview
                mediaType={mediaType}
                mediaUrl={mediaUrl}
                downloadUrl={downloadUrl}
              />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 min-h-64">
              <ClaimsList claims={claims} status={status} />
            </div>
          </div>
        </div>
      </main>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
