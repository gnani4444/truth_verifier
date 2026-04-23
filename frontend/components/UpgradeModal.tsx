"use client";

interface UpgradeModalProps {
  onClose: () => void;
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 text-sm">
            Get unlimited daily verifications and priority processing. Contact the
            admin to upgrade your account.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:vanamgnaneshwar@gmail.com?subject=Truth%20Verifier%20Pro%20Upgrade%20Request"
            className="flex items-center justify-center w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Contact Admin to Upgrade
          </a>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
