import { createServiceClient } from '@/lib/supabase/server';

/**
 * 학원 미니앱(/s/[slug]) 공개 데이터 조회 전용.
 * 서비스 클라이언트를 쓰되 공개 필드만 select 한다 (계좌·수익 필드 노출 금지).
 */

export interface MiniAcademy {
  id: string;
  slug: string | null;
  name_kr: string;
  name_en: string | null;
  description: string | null;
  logo_url: string | null;
  brand_color: string | null;
  preset_type: string | null;
  address: string | null;
  contact_number: string | null;
  instagram_handle: string | null;
  youtube_url: string | null;
  images: unknown;
  introduction_html: string | null;
  naver_map_url: string | null;
  kakao_channel_url: string | null;
}

const PUBLIC_ACADEMY_FIELDS =
  'id, slug, name_kr, name_en, description, logo_url, brand_color, preset_type, address, contact_number, instagram_handle, youtube_url, images, introduction_html, naver_map_url, kakao_channel_url';

export async function getAcademyBySlug(slugOrId: string): Promise<MiniAcademy | null> {
  const supabase = createServiceClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const { data } = await supabase
    .from('academies')
    .select(PUBLIC_ACADEMY_FIELDS)
    .eq(isUuid ? 'id' : 'slug', slugOrId)
    .eq('is_active', true)
    .maybeSingle();
  return (data as MiniAcademy | null) ?? null;
}

export interface MiniScheduleItem {
  id: string;
  start_time: string;
  end_time: string;
  max_students: number | null;
  current_students: number | null;
  is_canceled: boolean | null;
  card_color: string | null;
  classes: {
    id: string;
    title: string;
    genre: string | null;
    difficulty_level: string | null;
    class_type: string | null;
    instructor_name: string | null;
    thumbnail_url: string | null;
    poster_url: string | null;
    price: number | null;
    description: string | null;
  } | null;
}

/** 특정 주(일요일 시작)의 수업 일정 */
export async function getWeekSchedules(academyId: string, weekStart: Date): Promise<MiniScheduleItem[]> {
  const supabase = createServiceClient();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data } = await supabase
    .from('schedules')
    .select(
      'id, start_time, end_time, max_students, current_students, is_canceled, card_color, classes!inner(id, title, genre, difficulty_level, class_type, instructor_name, thumbnail_url, poster_url, price, description, academy_id, is_active)',
    )
    .eq('classes.academy_id', academyId)
    .eq('classes.is_active', true)
    .gte('start_time', weekStart.toISOString())
    .lt('start_time', weekEnd.toISOString())
    .order('start_time', { ascending: true });

  return ((data ?? []) as unknown as MiniScheduleItem[]).filter((s) => !s.is_canceled);
}

export interface MiniTicket {
  id: string;
  name: string;
  price: number | null;
  ticket_type: string;
  total_count: number | null;
  valid_days: number | null;
  ticket_category: string | null;
  description: string | null;
  auto_start_days: number | null;
  refund_policy: unknown;
  pause_policy: unknown;
}

export async function getPublicTickets(academyId: string): Promise<MiniTicket[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('tickets')
    .select('id, name, price, ticket_type, total_count, valid_days, ticket_category, description, auto_start_days, refund_policy, pause_policy')
    .eq('academy_id', academyId)
    .eq('is_on_sale', true)
    .eq('is_public', true)
    .order('price', { ascending: true });
  return ((data ?? []) as MiniTicket[]);
}

export interface MiniWorkshop {
  id: string;
  title: string;
  genre: string | null;
  description: string | null;
  poster_url: string | null;
  thumbnail_url: string | null;
  instructor_name: string | null;
  price: number | null;
  sessions: { id: string; start_time: string; end_time: string; max_students: number | null; current_students: number | null }[];
}

/** 다가오는 워크샵/팝업 (class_type WORKSHOP|POPUP, 미래 세션 보유) */
export async function getUpcomingWorkshops(academyId: string): Promise<MiniWorkshop[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('classes')
    .select('id, title, genre, description, poster_url, thumbnail_url, instructor_name, price, class_type, is_active, schedules(id, start_time, end_time, max_students, current_students, is_canceled)')
    .eq('academy_id', academyId)
    .eq('is_active', true)
    .in('class_type', ['WORKSHOP', 'POPUP']);

  const now = new Date().toISOString();
  const rows = (data ?? []) as unknown as (MiniWorkshop & { schedules: (MiniWorkshop['sessions'][number] & { is_canceled: boolean | null })[] })[];
  return rows
    .map((c) => ({
      ...c,
      sessions: (c.schedules ?? [])
        .filter((s) => !s.is_canceled && s.start_time >= now)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))
    .filter((c) => c.sessions.length > 0)
    .sort((a, b) => a.sessions[0].start_time.localeCompare(b.sessions[0].start_time));
}

export async function getWorkshopById(academyId: string, classId: string): Promise<MiniWorkshop | null> {
  const list = await getUpcomingWorkshops(academyId);
  return list.find((w) => w.id === classId) ?? null;
}
