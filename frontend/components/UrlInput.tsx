'use client';

import { useState } from 'react';

interface Props {
  onVerify: (url: string, useVision: boolean) => void;
  loading: boolean;
  showVision?: boolean;
}

export default function UrlInput({ onVerify, loading, showVision = false }: Props) {
  const [url, setUrl] = useState('');
  const [useVision, setUseVision] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onVerify(trimmed, useVision);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
      {showVision && (
        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={useVision}
            onChange={(e) => setUseVision(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-sm text-gray-600">
            Enable Visual Analysis{' '}
            <span className="text-gray-400">(Gemini Vision — requires GEMINI_API_KEY)</span>
          </span>
        </label>
      )}
    </div>
  );
}
