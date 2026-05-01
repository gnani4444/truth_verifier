import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify',
  description: 'Paste any Instagram post or reel URL to instantly fact-check every claim with AI. Get real-time TRUE, FALSE, or UNVERIFIABLE verdicts with source links.',
  keywords: ['verify instagram post', 'fact check reel', 'instagram claim checker', 'AI verification tool'],
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
