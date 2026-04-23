"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  email: string | null;
  tier: string | null;
}

export default function Navbar({ email, tier }: NavbarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const tierColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    pro: "bg-green-100 text-green-700",
    free: "bg-gray-100 text-gray-600",
  };
  const tierClass = tier ? (tierColors[tier] ?? "bg-gray-100 text-gray-600") : "";

  return (
    <nav className="flex items-center justify-between py-4 px-6 bg-white border-b border-gray-100 shadow-sm">
      <Link href="/" className="text-lg font-bold text-gray-900 tracking-tight">
        Truth Verifier
      </Link>

      <div className="flex items-center gap-4">
        {tier && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierClass}`}>
            {tier.toUpperCase()}
          </span>
        )}
        {email && (
          <Link
            href="/profile"
            title={email}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition-all"
          >
            {email[0].toUpperCase()}
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
