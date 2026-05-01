import type { Metadata } from 'next';
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LandingNavbar from "@/components/LandingNavbar";

export const metadata: Metadata = {
  title: 'Truth Verifier — AI-Powered Instagram Fact Checker',
  description: 'Stop the spread of misinformation. Paste any Instagram post URL and get AI-powered fact-checking with real-time TRUE / FALSE / UNVERIFIABLE verdicts. Free to start.',
  keywords: ['fact check instagram', 'instagram misinformation', 'AI claim verification', 'instagram fact checker', 'social media truth checker', 'real-time fact checking'],
  openGraph: {
    title: 'Truth Verifier — Stop Misinformation Before It Spreads',
    description: 'AI-powered Instagram fact-checking. Paste a URL, get instant claim-by-claim verdicts backed by real sources.',
    url: 'https://truthverifier.app',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truth Verifier — Stop Misinformation',
    description: 'AI-powered Instagram fact-checking. Paste a URL, get instant verdicts.',
  },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/verify");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingNavbar />

      {/* ── Section 1: Hero ── */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          {/* Eyebrow pill */}
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold mb-6">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="currentColor"
              />
            </svg>
            AI-Powered Fact Checking
          </span>

          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6">
            Don&apos;t Share Until You Know It&apos;s True
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
            Truth Verifier analyzes Instagram posts, extracts every factual
            claim, and checks each one against real sources — in real time.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link
              href="/register"
              className="px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:opacity-90 transition-opacity shadow-lg"
            >
              Get Started for Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 text-base font-semibold text-gray-700 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
          </div>

          <p className="text-sm text-gray-400">
            Free tier available · No credit card required
          </p>

          {/* Hero mockup card */}
          <div className="mt-16 max-w-lg mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Sample Verification
            </p>

            {/* Row 1: TRUE */}
            <div className="flex items-start gap-3 py-3 border-b border-gray-50">
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                TRUE
              </span>
              <span className="text-sm text-gray-700">
                Regular exercise reduces risk of heart disease by up to 35%
              </span>
            </div>

            {/* Row 2: FALSE */}
            <div className="flex items-start gap-3 py-3 border-b border-gray-50">
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                FALSE
              </span>
              <span className="text-sm text-gray-700">
                You only use 10% of your brain at any given time
              </span>
            </div>

            {/* Row 3: UNVERIFIABLE */}
            <div className="flex items-start gap-3 py-3">
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                UNVERIFIABLE
              </span>
              <span className="text-sm text-gray-700">
                This ancient remedy has been used for thousands of years
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: How It Works ── */}
      <section className="bg-white py-20">
        <div className="text-center px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            How It Works
          </h2>
          <p className="text-gray-500 text-lg mb-16">
            Three steps to fact-checked clarity
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6">
          {/* Step 1 */}
          <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-5">
              1
            </div>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-blue-500 mx-auto"
              aria-hidden="true"
            >
              <path
                d="M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59699 21.9548 8.33397 21.9434 7.02299C21.932 5.71201 21.4061 4.45794 20.4791 3.53093C19.5521 2.60392 18.298 2.07805 16.987 2.06661C15.676 2.05517 14.413 2.55918 13.47 3.46997L11.75 5.17997"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 11C13.5705 10.4259 13.0226 9.95077 12.3934 9.60706C11.7642 9.26334 11.0684 9.05891 10.3533 9.00768C9.63816 8.95646 8.92037 9.05966 8.24861 9.31023C7.57685 9.5608 6.96684 9.95302 6.45996 10.46L3.45996 13.46C2.54917 14.403 2.04516 15.666 2.0566 16.977C2.06804 18.288 2.59390 19.5421 3.52092 20.4691C4.44793 21.3961 5.70200 21.9219 7.01298 21.9334C8.32396 21.9448 9.58698 21.4408 10.53 20.53L12.24 18.82"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
              Paste an Instagram URL
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Drop any public Instagram post or reel URL into Truth Verifier
            </p>

            {/* Arrow to next step */}
            <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-300"
                aria-hidden="true"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-5">
              2
            </div>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-indigo-500 mx-auto"
              aria-hidden="true"
            >
              <path
                d="M12 2L13.09 8.26L20 9.27L15 14.14L16.18 21.02L12 17.77L7.82 21.02L9 14.14L4 9.27L10.91 8.26L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
              AI Extracts Claims
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Our model reads the post and identifies every factual statement
              automatically
            </p>

            {/* Arrow to next step */}
            <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-300"
                aria-hidden="true"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-10 h-10 rounded-full bg-purple-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-5">
              3
            </div>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-purple-500 mx-auto"
              aria-hidden="true"
            >
              <path
                d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.7088 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 4L12 14.01L9 11.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
              Get Real-Time Verdicts
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Each claim is verified against live sources and labeled TRUE,
              FALSE, or UNVERIFIABLE
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Key Features ── */}
      <section className="bg-gray-50 py-20">
        <div className="text-center px-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Built for Truth
          </h2>
          <p className="text-gray-500 text-lg mb-16">
            Everything you need to stop misinformation in its tracks
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto px-6">
          {/* Feature 1 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-blue-600"
                aria-hidden="true"
              >
                <path
                  d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">
              Real-Time Fact Checking
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Claims are verified live as you watch — no waiting for a batch
              report
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-indigo-600"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M21 21L16.65 16.65"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">
              AI Claim Extraction
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Automatically isolates every verifiable statement in a post
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-green-600"
                aria-hidden="true"
              >
                <path
                  d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 3H21V9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 14L21 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">
              Source-Backed Verdicts
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Every verdict links to the actual source used to confirm or deny
              the claim
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-purple-600"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">
              Three-Level Results
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Clear TRUE / FALSE / UNVERIFIABLE — no ambiguous ratings
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-pink-600"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="5"
                  ry="5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16 11.37C16 12.5255 15.4696 13.6237 14.5355 14.4239C13.6014 15.2241 12.3361 15.6667 11 15.6667C9.66391 15.6667 8.39863 15.2241 7.46447 14.4239C6.53031 13.6237 6 12.5255 6 11.37"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">
              Instagram Native
            </h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Works directly with Instagram post URLs — no copy-pasting caption
              text
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-amber-600"
                aria-hidden="true"
              >
                <path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Free to Start</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Try it free — upgrade when you need more daily verifications
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: CTA Banner ── */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Verifying Today
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            Join Truth Verifier and stop misinformation before it spreads.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 text-base font-semibold text-blue-600 bg-white rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
            >
              Get Started for Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 text-base font-semibold text-white border-2 border-white/40 rounded-xl hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 5: Footer ── */}
      <footer className="bg-gray-900 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left */}
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 2L3 6.5V12C3 16.97 6.84 21.61 12 23C17.16 21.61 21 16.97 21 12V6.5L12 2Z"
                fill="white"
                fillOpacity="0.9"
              />
              <path
                d="M9 12L11 14L15 10"
                stroke="#1D4ED8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-bold text-white text-lg">Truth Verifier</span>
            <span className="text-gray-400 text-sm ml-2">· Fact-check smarter.</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/login"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Get Started
            </Link>
            <span className="text-gray-600">© 2025 Truth Verifier</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
