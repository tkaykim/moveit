import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { generateUniqueSlug } from '@/lib/utils/slug-server';
import { getPreset } from '@/lib/presets/academy-presets';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

type UserRole = Database['public']['Enums']['user_role'];

interface FirstClassInput {
  title: string;
  genre?: string;
  instructor_name?: string;
  days_of_week: number[]; // 0=일 ... 6=토 (JS getDay 기준)
  start_time: string; // "19:00"
  end_time: string; // "20:20"
}

/**
 * 온보딩 위저드 3스텝 완료 시 한 번에 셋업.
 * ① 학원(이름·색·로고) ② 운영방식 프리셋 → 수강권 자동 생성 ③ 대표 수업 1개 → 반복 일정 8주 생성.
 * 계좌·강사·홀 상세는 요구하지 않는다 (메인홀 자동 생성, 나머지는 사용 시점에 입력).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const name_kr: string = body?.name_kr?.trim();
    if (!name_kr) {
      return NextResponse.json({ error: '학원 이름을 입력해 주세요.' }, { status: 400 });
    }
    const presetKey: string = body?.preset_key;
    const preset = getPreset(presetKey);
    if (!preset) {
      return NextResponse.json({ error: '운영 방식을 선택해 주세요.' }, { status: 400 });
    }

    const brandColor: string | null =
      typeof body?.brand_color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.brand_color)
        ? body.brand_color
        : null;
    const logoUrl: string | null = typeof body?.logo_url === 'string' && body.logo_url ? body.logo_url : null;
    const nameEn: string | null = body?.name_en?.trim() || null;

    const supabase = createServiceClient();

    // slug: 영문명 우선, 없으면 위저드가 준 slug 후보, 그것도 없으면 랜덤
    const slugSource: string =
      nameEn || (typeof body?.slug_hint === 'string' && body.slug_hint.trim()) || `studio-${Math.random().toString(36).slice(2, 6)}`;
    const slug = await generateUniqueSlug(supabase, slugSource);

    const { data: academy, error: acError } = await supabase
      .from('academies')
      .insert([
        {
          name_kr,
          name_en: nameEn,
          slug: slug || null,
          is_active: true,
          brand_color: brandColor,
          preset_type: preset.key,
          logo_url: logoUrl,
          contact_number: body?.contact_number?.trim() || null,
          instagram_handle: body?.instagram_handle?.trim()?.replace(/^@/, '') || null,
        },
      ] as never)
      .select('id, slug')
      .single();

    if (acError || !academy) {
      console.error('[onboarding/setup] academies insert:', acError);
      return NextResponse.json({ error: '학원 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    const academyId = (academy as { id: string; slug: string | null }).id;

    // 메인홀 자동 생성 (원장이 홀 개념을 몰라도 되게)
    const { data: hall } = await supabase
      .from('halls')
      .insert({ academy_id: academyId, name: '메인홀', capacity: 20 } as never)
      .select('id')
      .single();

    // 소유자 역할 (중복 대비 멱등)
    const { error: roleError } = await supabase.from('academy_user_roles').insert({
      user_id: user.id,
      academy_id: academyId,
      role: 'ACADEMY_OWNER',
    } as never);
    if (roleError && roleError.code !== '23505') {
      console.error('[onboarding/setup] role insert:', roleError);
      return NextResponse.json({ error: '운영자 등록에 실패했습니다.' }, { status: 500 });
    }

    // users.role 승격 (SUPER_ADMIN 보존)
    const { data: currentUser } = await supabase.from('users').select('role').eq('id', user.id).single();
    if ((currentUser as { role?: UserRole } | null)?.role !== 'SUPER_ADMIN') {
      await supabase.from('users').update({ role: 'ACADEMY_OWNER' } as never).eq('id', user.id);
    }

    // 프리셋 수강권 생성
    const ticketRows = preset.tickets.map((t) => ({
      academy_id: academyId,
      name: t.name,
      ticket_type: t.ticket_type,
      total_count: t.total_count ?? null,
      valid_days: t.valid_days ?? null,
      price: t.price,
      is_coupon: t.is_coupon ?? false,
      is_general: t.is_general ?? true,
      is_on_sale: true,
      is_public: t.is_public ?? true,
      ticket_category: t.ticket_category,
      description: t.description ?? null,
      auto_start_days: t.auto_start_days ?? null,
      refund_policy: t.refund_policy ?? null,
      pause_policy: t.pause_policy ?? null,
    }));
    const { error: ticketError } = await supabase.from('tickets').insert(ticketRows as never);
    if (ticketError) {
      console.error('[onboarding/setup] tickets insert:', ticketError);
      // 수강권 실패는 치명 아님 — 학원은 만들어졌으므로 계속 진행하되 알림
    }

    // 대표 수업 1개 + 8주 반복 일정
    const firstClass: FirstClassInput | null = body?.first_class ?? null;
    if (firstClass?.title?.trim() && Array.isArray(firstClass.days_of_week) && firstClass.days_of_week.length > 0) {
      const { data: cls, error: clsError } = await supabase
        .from('classes')
        .insert({
          academy_id: academyId,
          title: firstClass.title.trim(),
          genre: firstClass.genre?.trim() || null,
          class_type: 'REGULAR',
          instructor_name: firstClass.instructor_name?.trim() || null,
          hall_id: (hall as { id: string } | null)?.id ?? null,
          max_students: 20,
          is_active: true,
          status: 'ACTIVE',
        } as never)
        .select('id')
        .single();

      if (!clsError && cls) {
        const classId = (cls as { id: string }).id;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7 * 8); // 8주

        const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
        const { data: rec } = await supabase
          .from('recurring_schedules')
          .insert({
            class_id: classId,
            days_of_week: firstClass.days_of_week,
            start_date: toDateStr(startDate),
            end_date: toDateStr(endDate),
            start_time: firstClass.start_time,
            end_time: firstClass.end_time,
            interval_weeks: 1,
          } as never)
          .select('id')
          .single();

        // 세션 생성 (8주치)
        const sessions: Record<string, unknown>[] = [];
        const cursor = new Date(startDate);
        while (cursor <= endDate) {
          if (firstClass.days_of_week.includes(cursor.getDay())) {
            const dateStr = toDateStr(cursor);
            sessions.push({
              class_id: classId,
              recurring_schedule_id: (rec as { id: string } | null)?.id ?? null,
              start_time: `${dateStr}T${firstClass.start_time}:00+09:00`,
              end_time: `${dateStr}T${firstClass.end_time}:00+09:00`,
              hall_id: (hall as { id: string } | null)?.id ?? null,
              max_students: 20,
              current_students: 0,
              is_canceled: false,
            });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
        if (sessions.length > 0) {
          const { error: schedError } = await supabase.from('schedules').insert(sessions as never);
          if (schedError) console.error('[onboarding/setup] schedules insert:', schedError);
        }
      } else if (clsError) {
        console.error('[onboarding/setup] class insert:', clsError);
      }
    }

    return NextResponse.json({
      academyId,
      slug: (academy as { slug: string | null }).slug,
      miniAppPath: `/s/${(academy as { slug: string | null }).slug || academyId}`,
      adminPath: `/academy-admin/${(academy as { slug: string | null }).slug || academyId}`,
      ticketsCreated: ticketError ? 0 : ticketRows.length,
    });
  } catch (error) {
    console.error('[onboarding/setup] Error:', error);
    return NextResponse.json({ error: '설정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
