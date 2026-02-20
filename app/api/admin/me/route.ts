/**
 * GET /api/admin/me
 * 현재 요청자가 SUPER_ADMIN인지 서버에서 확인. admin 레이아웃에서 프로필 실패 시 폴백으로 사용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/supabase/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (auth.error) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  return NextResponse.json({ ok: true, role: 'SUPER_ADMIN' });
}
