import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * P0-2 (2026-04-20): Pre-signup email presence check.
 * Returns whether an email is already associated with a guest row in public.users,
 * so the client can distinguish Case B (legitimate existing member, need login)
 * from Case C (orphan guest row sharing an auth.users id — recoverable via RPC v2).
 *
 * Body: { email: string }
 * Returns: { isGuest: boolean }
 *   - isGuest=true  → public.users has a row with is_guest=true for this email
 *   - isGuest=false → no guest row; if signUp errors with "already registered", it is Case B
 *
 * Note: uses service role to bypass RLS for a minimal-info lookup. Returns only a boolean.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body?.email === 'string' ? body.email : '';
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ isGuest: false });
    }

    const supabase = createServiceClient() as any;
    const { data, error } = await supabase
      .from('users')
      .select('id, is_guest')
      .ilike('email', email)
      .eq('is_guest', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      // Non-fatal: treat as not-guest so the UI falls back to the generic "please log in" path.
      return NextResponse.json({ isGuest: false });
    }

    return NextResponse.json({ isGuest: !!data });
  } catch {
    return NextResponse.json({ isGuest: false });
  }
}
