'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UrlInput from '@/components/UrlInput';
import MediaPreview from '@/components/MediaPreview';
import ClaimsList from '@/components/ClaimsList';
import { postVerify, getMediaUrl, streamResults } from '@/lib/api';
import type { ClaimResult } from '@/lib/api';
import type { ClaimState, SseEvent } from '@/types';
import { createClient } from '@/lib/supabase/client';

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [visionRequired, setVisionRequired] = useState(false);
  const [lastUrl, setLastUrl] = useState('');
  const [lastUseVision, setLastUseVision] = useState(false);
  const [mediaType, setMediaType] = useState<'video' | 'image' | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimState[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleVerify = useCallback(async (url: string, useVision: boolean, forceRefresh: boolean = false) => {
    setLoading(true);
    setError('');
    setVisionRequired(false);
    setLastUrl(url);
    setLastUseVision(useVision);
    setStatus('Connecting to server...');
    setClaims([]);
    setExtractedText(null);
    setMediaUrl(null);
    setMediaType(null);
    setDownloadUrl(null);

    let cleanup: (() => void) | null = null;

    try {
      const { jobId, claims: cachedClaims, extractedText: cachedText } = await postVerify(url, useVision, forceRefresh);

      // Cache hit: populate claims directly without streaming
      if (cachedClaims !== null) {
        const doneStates: ClaimState[] = cachedClaims.map((c: ClaimResult) => ({
          text: c.text,
          status: 'done',
          verdict: c.verdict,
          explanation: c.explanation,
          source: c.source,
        }));
        setClaims(doneStates);
        if (cachedText !== null) {
          setExtractedText(cachedText);
        }
        setStatus('');
        setLoading(false);
        return;
      }

      // Cache miss: stream results
      if (jobId !== null) {
        cleanup = streamResults(
          jobId,
          url,
          useVision,
          (event: SseEvent) => {
            if (event.type === 'status') {
              setStatus(event.message);
            } else if (event.type === 'media') {
              const mediaUrlValue = getMediaUrl(jobId);
              setMediaUrl(mediaUrlValue);
              setDownloadUrl(mediaUrlValue);
              setMediaType(event.media_type);
            } else if (event.type === 'text') {
              setExtractedText(event.content);
            } else if (event.type === 'claim') {
              setClaims((prev) => [...prev, { text: event.text, status: 'checking' }]);
            } else if (event.type === 'result') {
              setClaims((prev) =>
                prev.map((c) =>
                  c.text === event.text
                    ? {
                        text: event.text,
                        status: 'done',
                        verdict: event.verdict,
                        explanation: event.explanation,
                        source: event.source,
                      }
                    : c
                )
              );
            } else if (event.type === 'done') {
              setStatus('');
              setLoading(false);
              cleanup?.();
            } else if (event.type === 'error') {
              setError(event.message);
              setVisionRequired(event.vision_required === true);
              setStatus('');
              setLoading(false);
              cleanup?.();
            }
          },
          (err) => {
            setError(err.message);
            setStatus('');
            setLoading(false);
          }
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to server. Is it running?';
      setError(message);
      setStatus('');
      setLoading(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* User header */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {userEmail && (
            <span className="text-sm text-gray-600">{userEmail}</span>
          )}
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            Sign out
          </button>
        </div>

        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-gray-900">Truth Verifier</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Paste a public Instagram post or reel URL to fact-check its claims
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 flex items-end gap-3">
          <div className="flex-1">
            <UrlInput onVerify={handleVerify} loading={loading} />
          </div>
          {(extractedText || claims.length > 0) && !loading && (
            <button
              onClick={() => handleVerify(lastUrl, lastUseVision, true)}
              className="shrink-0 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors border border-gray-200"
              title="Clear cache and re-run from scratch"
            >
              ↺ Refresh
            </button>
          )}
        </div>

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
  );
}
