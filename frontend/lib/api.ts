import type { SseEvent } from '@/types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function postVerify(url: string, useVision: boolean = false): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, use_vision: useVision }),
  });
  if (!res.ok) throw new Error('Failed to start verification');
  const data = await res.json();
  return data.job_id as string;
}

export function getMediaUrl(jobId: string): string {
  return `${BACKEND_URL}/media/${jobId}`;
}

export function streamResults(
  jobId: string,
  onEvent: (event: SseEvent) => void,
  onError: (err: Error) => void
): () => void {
  const es = new EventSource(`${BACKEND_URL}/verify/stream/${jobId}`);

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
