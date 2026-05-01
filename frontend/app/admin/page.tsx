import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import AdminTabs from '@/components/admin/AdminTabs';

export const dynamic = 'force-dynamic';

export interface UserProfile {
  id: string;
  email: string;
  tier: string;
  created_at: string;
  verifications_today: number;
}

export interface LogClaim {
  claim: string;
  verdict: 'TRUE' | 'FALSE' | 'UNVERIFIABLE';
  explanation?: string;
  source?: string;
  [key: string]: unknown;
}

export interface AdminLog {
  id: string;
  user_email: string;
  url: string;
  use_vision: boolean;
  created_at: string;
  claims: LogClaim[] | null;
  true_count: number;
  false_count: number;
  unverifiable_count: number;
}

type ProfileRow = { id: string; email: string; tier: string; created_at: string };
type LogRow = {
  id: string;
  url: string;
  use_vision: boolean;
  created_at: string;
  claims: LogClaim[] | null;
  profiles: { email: string } | null;
};

export default async function AdminPage() {
  // 1. Verify session and admin tier server-side
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (!callerProfile || callerProfile.tier !== 'admin') {
    notFound();
  }

  // 2. Create service role client for privileged reads
  const serviceClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  );

  // 3a. Fetch all user profiles
  const { data: profileRows } = await serviceClient
    .from('profiles')
    .select('id, email, tier, created_at')
    .order('created_at', { ascending: false });

  // Count today's verifications per user
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: todayCounts } = await serviceClient
    .from('api_logs')
    .select('user_id')
    .gte('created_at', todayStart.toISOString());

  // Build a map: user_id → count
  const verificationsToday: Record<string, number> = {};
  for (const row of todayCounts ?? []) {
    verificationsToday[row.user_id] = (verificationsToday[row.user_id] ?? 0) + 1;
  }

  const users: UserProfile[] = ((profileRows ?? []) as ProfileRow[]).map((p) => ({
    ...p,
    verifications_today: verificationsToday[p.id] ?? 0,
  }));

  // 3b. Fetch first page of logs directly via service client
  const PAGE_SIZE = 20;

  const { data: logRows, count: logCount } = await serviceClient
    .from('api_logs')
    .select('*, profiles!user_id(email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const initialLogs: AdminLog[] = ((logRows ?? []) as LogRow[]).map((log) => {
    const email: string = log.profiles?.email ?? 'unknown';
    let true_count = 0;
    let false_count = 0;
    let unverifiable_count = 0;

    if (Array.isArray(log.claims)) {
      (log.claims as LogClaim[]).forEach((c) => {
        if (c.verdict === 'TRUE') true_count++;
        else if (c.verdict === 'FALSE') false_count++;
        else unverifiable_count++;
      });
    }

    return {
      id: log.id,
      user_email: email,
      url: log.url,
      use_vision: log.use_vision,
      created_at: log.created_at,
      claims: log.claims ?? null,
      true_count,
      false_count,
      unverifiable_count,
    };
  });

  const initialTotal = logCount ?? 0;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="pt-4 pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage users and review verification logs
          </p>
        </div>

        <AdminTabs
          users={users}
          initialLogs={initialLogs}
          initialTotal={initialTotal}
        />
      </div>
    </main>
  );
}
