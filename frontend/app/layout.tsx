import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://truthverifier.app'),
  title: {
    default: 'Truth Verifier — AI-Powered Instagram Fact Checker',
    template: '%s | Truth Verifier',
  },
  description: 'Instantly fact-check Instagram posts and reels. AI extracts every factual claim and verifies it against trusted sources. Free to start.',
  keywords: ['fact check instagram', 'instagram fact checker', 'AI fact checking', 'misinformation detector', 'claim verification', 'social media fact check', 'truth verifier'],
  authors: [{ name: 'Truth Verifier' }],
  openGraph: {
    type: 'website',
    siteName: 'Truth Verifier',
    title: 'Truth Verifier — AI-Powered Instagram Fact Checker',
    description: 'Instantly fact-check Instagram posts and reels. AI extracts every factual claim and verifies it against real sources.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truth Verifier — AI-Powered Instagram Fact Checker',
    description: 'Instantly fact-check Instagram posts and reels with AI.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
