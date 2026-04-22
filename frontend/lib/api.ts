import type { SseEvent } from '@/types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface ClaimResult {
  text: string;
  verdict: 'TRUE' | 'FALSE' | 'UNVERIFIABLE';
  explanation: string;
  source: string;
}

export async function postVerify(
  url: string,
  useVision: boolean = false,
  forceRefresh: boolean = false
): Promise<{ jobId: string | null; claims: ClaimResult[] | null; extractedText: string | null }> {
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, use_vision: useVision, force_refresh: forceRefresh }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to start verification');
  }
  const data = await res.json();
  return {
    jobId: data.job_id ?? null,
    claims: data.claims ?? null,
    extractedText: data.extracted_text ?? null,
  };
}

export function getMediaUrl(jobId: string): string {
  return `${BACKEND_URL}/media/${jobId}`;
}

export function streamResults(
  jobId: string,
  url: string,
  useVision: boolean,
  onEvent: (event: SseEvent) => void,
  onError: (err: Error) => void
): () => void {
  const streamUrl = `/api/verify/stream/${jobId}?url=${encodeURIComponent(url)}&use_vision=${useVision}`;
  const es = new EventSource(streamUrl);

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as SseEvent;
      onEvent(event);
    } catch {
      // ignore malformed events
    }
  };

  es.onerror = () => {
    es.close();
    onError(new Error('Stream connection failed'));
  };

  return () => es.close();
}
