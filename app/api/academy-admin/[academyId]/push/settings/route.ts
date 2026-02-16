import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { academyId: string } }
) {
  const supabase = createServiceClient();
  const { academyId } = params;

  try {
    // 권한 확인
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 1. SUPER_ADMIN 여부 확인
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      // 2. 학원 관리자 권한 확인
      const { data: roleData, error: roleError } = await (supabase as any)
        .from('academy_user_roles')
        .select('role')
        .eq('academy_id', academyId)
        .eq('user_id', user.id)
        .single();

      if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
        return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
      }
    }

    const { data, error } = await (supabase as any)
      .from('academy_notification_settings')
      .select('*')
      .eq('academy_id', academyId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
      throw error;
    }

    // If no settings exist, return default (all true)
    if (!data) {
      return NextResponse.json({
        booking_confirmed: true,
        booking_cancelled: true,
        class_reminder: true,
        class_cancelled: true,
        attendance_checked: true,
        attendance_absent: true,
        ticket_purchased: true,
        ticket_expiry: true,
        video_uploaded: true,
        consultation_reply: true,
        marketing: true,
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { academyId: string } }
) {
  const supabase = createServiceClient();
  const { academyId } = params;
  const body = await request.json();

  try {
    // 권한 확인
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 1. SUPER_ADMIN 여부 확인
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const isSuperAdmin = userData?.role === 'SUPER_ADMIN';

    if (!isSuperAdmin) {
      // 2. 학원 관리자 권한 확인
      const { data: roleData, error: roleError } = await (supabase as any)
        .from('academy_user_roles')
        .select('role')
        .eq('academy_id', academyId)
        .eq('user_id', user.id)
        .single();

      if (roleError || !roleData || !['ACADEMY_OWNER', 'ACADEMY_MANAGER'].includes(roleData.role)) {
        return NextResponse.json({ error: '학원 관리자 권한이 필요합니다.' }, { status: 403 });
      }
    }

    // Upsert settings
    const { data, error } = await (supabase as any)
      .from('academy_notification_settings')
      .upsert({
        academy_id: academyId,
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
