'use client';

interface Props {
  mediaType: 'video' | 'image' | null;
  mediaUrl: string | null;
  downloadUrl: string | null;
}

export default function MediaPreview({ mediaType, mediaUrl, downloadUrl }: Props) {
  if (!mediaUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-200 gap-3">
        <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-400 text-sm font-medium">Media preview will appear here</p>
        <p className="text-gray-300 text-xs">Supports images and video reels</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mediaType === 'video' ? (
        <div className="rounded-xl overflow-hidden bg-black shadow-sm">
          <video src={mediaUrl} controls className="w-full" />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden shadow-sm">
          <img src={mediaUrl} alt="Instagram post" className="w-full object-contain" />
        </div>
      )}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-200 text-gray-700 bg-white rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      )}
    </div>
  );
}
