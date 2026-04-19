'use client';

import { useState, useCallback } from 'react';
import UrlInput from '@/components/UrlInput';
import MediaPreview from '@/components/MediaPreview';
import ClaimsList from '@/components/ClaimsList';
import { postVerify, getMediaUrl, streamResults } from '@/lib/api';
import type { ClaimState, SseEvent } from '@/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [visionRequired, setVisionRequired] = useState(false);
  const [lastUrl, setLastUrl] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image' | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimState[]>([]);

  const handleVerify = useCallback(async (url: string, useVision: boolean) => {
    setLoading(true);
    setError('');
    setVisionRequired(false);
    setLastUrl(url);
    setStatus('Connecting to server...');
    setClaims([]);
    setMediaUrl(null);
    setMediaType(null);
    setDownloadUrl(null);

    let cleanup: (() => void) | null = null;

    try {
      const jobId = await postVerify(url, useVision);

      cleanup = streamResults(
        jobId,
        (event: SseEvent) => {
          if (event.type === 'status') {
            setStatus(event.message);
          } else if (event.type === 'media') {
            const url = getMediaUrl(jobId);
            setMediaUrl(url);
            setDownloadUrl(url);
            setMediaType(event.media_type);
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
    } catch {
      setError('Failed to connect to server. Is it running?');
      setStatus('');
      setLoading(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-gray-900">Truth Verifier</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Paste a public Instagram post or reel URL to fact-check its claims
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <UrlInput onVerify={handleVerify} loading={loading} />
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
