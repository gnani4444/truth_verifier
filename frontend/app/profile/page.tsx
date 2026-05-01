import type { Metadata } from 'next';
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "@/components/ProfileClient";

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'View your verification history, daily usage, and account settings on Truth Verifier.',
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  let used = 0;
  if (profile.tier === "free") {
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("api_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayUTC.toISOString());
    used = count ?? 0;
  }

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <ProfileClient
      email={user.email ?? profile.email ?? ""}
      tier={profile.tier}
      memberSince={memberSince}
      used={used}
      limit={profile.tier === "free" ? 5 : null}
    />
  );
}
