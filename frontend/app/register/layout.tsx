import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started Free',
  description: 'Create your free Truth Verifier account. Start fact-checking Instagram posts instantly — no credit card required.',
  keywords: ['sign up', 'free fact checker', 'instagram fact check account', 'truth verifier registration'],
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
