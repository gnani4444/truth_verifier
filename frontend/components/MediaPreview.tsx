'use client';

interface Props {
  mediaType: 'video' | 'image' | null;
  mediaUrl: string | null;
  downloadUrl: string | null;
}

export default function MediaPreview({ mediaType, mediaUrl, downloadUrl }: Props) {
  if (!mediaUrl) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">Media preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mediaType === 'video' ? (
        <video
          src={mediaUrl}
          controls
          className="w-full rounded-lg bg-black"
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Instagram post"
          className="w-full rounded-lg object-contain"
        />
      )}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          className="block w-full text-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Download
        </a>
      )}
    </div>
  );
}
