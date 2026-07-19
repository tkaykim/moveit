import { createServiceClient } from '@/lib/supabase/server';
import {
  resolveBookingPolicy,
  bookingOpenAt,
  bookingCloseAt,
  evaluateBookingWindow,
  type BookingWindowState,
} from '@/lib/booking/policy';

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
  /** 예약 정책 학원 기본값 — 시간표의 "언제 열리나" 표시에 필요 */
  booking_policy: unknown;
  /** 미니앱 스킨(문구·라벨·안내)의 저장소. 학원별 데이터로만 스킨을 바꾼다. */
  section_config: unknown;
}

const PUBLIC_ACADEMY_FIELDS =
  'id, slug, name_kr, name_en, description, logo_url, brand_color, preset_type, address, contact_number, instagram_handle, youtube_url, images, introduction_html, naver_map_url, kakao_channel_url, booking_policy, section_config';

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

/* ------------------------------------------------------------------ */
/* 주간 시간표 보드 (T10)                                              */
/* ------------------------------------------------------------------ */

/**
 * 한 회차가 학생 화면에서 필요로 하는 모든 것.
 * 그룹·대상·정원·정책이 **한 번의 질의**로 함께 온다 — 회차마다 추가 요청은 결함이다.
 */
export interface MiniWeekItem {
  id: string;
  start_time: string;
  end_time: string;
  max_students: number | null;
  booked_count: number;
  is_full: boolean;
  card_color: string | null;

  class_id: string;
  title: string;
  genre: string | null;
  difficulty_level: string | null;
  instructor_name: string | null;

  /** 그룹 배지 */
  group_name: string | null;
  /** 특별수업 — 무제한(올패스)로 덮이지 않고 **별도 결제**가 필요하다 */
  is_special: boolean;
  /** 대상 한정 수업인가 (RLS 를 통과해 여기 온 이상 이 사용자는 볼 자격이 있다) */
  is_audience_limited: boolean;

  booking_state: BookingWindowState;
  /** 아직 안 열렸다면 언제 열리는지 (ISO) */
  opens_at: string | null;
  closes_at: string;
  bookable: boolean;
}

interface WeekQueryRow {
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
    instructor_name: string | null;
    audience_membership_id: string | null;
    booking_policy: unknown;
    class_group_id: string | null;
    class_groups: { id: string; name: string | null; is_special: boolean | null } | null;
  } | null;
}

/** schedules → classes → class_groups 를 한 번에 가져오는 단일 집계 질의 */
const WEEK_SELECT =
  'id, start_time, end_time, max_students, current_students, is_canceled, card_color, ' +
  'classes!inner(id, title, genre, difficulty_level, instructor_name, academy_id, is_active, ' +
  'audience_membership_id, booking_policy, class_group_id, ' +
  'class_groups(id, name, is_special))';

type QueryClient = {
  from: (table: string) => any;
};

/**
 * 한 주의 수업을 **질의 한 번**으로 읽는다.
 *
 * ⚠ client 는 반드시 **RLS 를 지키는(사용자 세션) 클라이언트**여야 한다.
 * 서비스롤을 넣으면 대상 한정 수업이 비회원에게도 새어나간다 —
 * 숨김의 정본은 RLS 이고, 화면은 돌려받은 것을 그대로 그린다(클라이언트 필터링 금지).
 */
export async function getWeekBoard(
  client: QueryClient,
  params: { academyId: string; academyBookingPolicy: unknown; weekStart: Date; now?: Date }
): Promise<MiniWeekItem[]> {
  const weekEnd = new Date(params.weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const now = params.now ?? new Date();

  const { data, error } = await client
    .from('schedules')
    .select(WEEK_SELECT)
    .eq('classes.academy_id', params.academyId)
    .eq('classes.is_active', true)
    .gte('start_time', params.weekStart.toISOString())
    .lt('start_time', weekEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw new Error(error.message ?? String(error));

  const rows = ((data ?? []) as unknown as WeekQueryRow[]).filter(
    (r) => !r.is_canceled && r.classes
  );

  return rows.map((r) => {
    const c = r.classes!;
    const policy = resolveBookingPolicy(params.academyBookingPolicy, c.booking_policy);
    const state = evaluateBookingWindow(r.start_time, policy, now);
    const openAt = bookingOpenAt(r.start_time, policy);
    const booked = r.current_students ?? 0;
    const isFull = typeof r.max_students === 'number' && booked >= r.max_students;

    return {
      id: r.id,
      start_time: r.start_time,
      end_time: r.end_time,
      max_students: r.max_students,
      booked_count: booked,
      is_full: isFull,
      card_color: r.card_color,

      class_id: c.id,
      title: c.title,
      genre: c.genre,
      difficulty_level: c.difficulty_level,
      instructor_name: c.instructor_name,

      group_name: c.class_groups?.name ?? null,
      is_special: Boolean(c.class_groups?.is_special),
      is_audience_limited: c.audience_membership_id != null,

      booking_state: state,
      opens_at: openAt ? openAt.toISOString() : null,
      closes_at: bookingCloseAt(r.start_time, policy).toISOString(),
      bookable: state === 'OPEN' && !isFull,
    };
  });
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
  // auto_start_days/refund_policy/pause_policy는 신규 컬럼 — 생성 타입 미반영이라 캐스팅
  const { data } = await (supabase as any)
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
    // classes_class_type_check 실제 허용값: 소문자 workshop/popup (+레거시 대문자 혼재 대비)
    .in('class_type', ['workshop', 'popup', 'WORKSHOP', 'POPUP', 'ONE_DAY']);

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
