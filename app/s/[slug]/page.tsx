import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Instagram, Youtube, MapPin, MessageCircle, ChevronRight, ArrowRight } from 'lucide-react';
import { getAcademyBySlug, getWeekSchedules, getUpcomingWorkshops } from '@/lib/db/miniapp';

export const dynamic = 'force-dynamic';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });

export default async function MiniHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  const brand = academy.brand_color || '#111111';
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [weekSchedules, workshops] = await Promise.all([
    getWeekSchedules(academy.id, todayStart),
    getUpcomingWorkshops(academy.id),
  ]);

  const now = new Date();
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayClasses = weekSchedules.filter(
    (s) =>
      new Date(s.start_time) >= now &&
      new Date(s.start_time) < todayEnd &&
      !['workshop', 'popup'].includes((s.classes?.class_type || '').toLowerCase()),
  );

  const sns = [
    academy.instagram_handle && {
      icon: Instagram,
      label: '인스타그램',
      href: `https://instagram.com/${academy.instagram_handle}`,
    },
    academy.youtube_url && { icon: Youtube, label: '유튜브', href: academy.youtube_url },
    academy.naver_map_url && { icon: MapPin, label: '오시는 길', href: academy.naver_map_url },
    academy.kakao_channel_url && { icon: MessageCircle, label: '카톡 문의', href: academy.kakao_channel_url },
  ].filter(Boolean) as { icon: typeof Instagram; label: string; href: string }[];

  return (
    <div>
      {/* ── 히어로: 브랜드 그라디언트 ── */}
      <section
        className="px-6 pt-10 pb-8"
        style={{ backgroundImage: `radial-gradient(120% 90% at 50% -20%, ${brand}26, transparent 72%)` }}
      >
        {academy.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={academy.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
        ) : (
          <span
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white shadow-lg"
            style={{ backgroundColor: brand, boxShadow: `0 12px 28px -8px ${brand}59`, display: 'inline-flex' }}
          >
            {(academy.name_kr || 'D').slice(0, 1)}
          </span>
        )}
        <h1 className="mt-4 text-[27px] font-extrabold tracking-tight leading-tight">{academy.name_kr}</h1>
        {academy.description && (
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
            {academy.description}
          </p>
        )}
        {academy.address && (
          <p className="mt-2.5 text-xs text-neutral-500 flex items-center gap-1">
            <MapPin size={12} /> {academy.address}
          </p>
        )}
        {sns.length > 0 && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {sns.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${brand}12`, color: brand }}
              >
                <Icon size={13} /> {label}
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="px-6 space-y-9 pb-8">
        {/* ── 워크샵 ── */}
        {workshops.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-3.5">
              <div>
                <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: brand }}>
                  Special
                </p>
                <h2 className="text-lg font-extrabold tracking-tight mt-0.5">워크샵 · 이벤트</h2>
              </div>
              <Link href={`/s/${slug}/workshops`} className="text-xs font-semibold text-neutral-400 flex items-center pb-0.5">
                전체 보기 <ChevronRight size={13} />
              </Link>
            </div>
            <div className="flex gap-3.5 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
              {workshops.slice(0, 5).map((w) => (
                <Link
                  key={w.id}
                  href={`/s/${slug}/workshops/${w.id}`}
                  className="flex-shrink-0 w-44 snap-start"
                >
                  {w.poster_url || w.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.poster_url || w.thumbnail_url || ''}
                      alt={w.title}
                      className="w-44 h-56 rounded-2xl object-cover shadow-sm"
                    />
                  ) : (
                    <div
                      className="w-44 h-56 rounded-2xl flex flex-col items-center justify-center text-white p-4 text-center"
                      style={{ backgroundImage: `linear-gradient(150deg, ${brand}, ${brand}99)` }}
                    >
                      <span className="text-3xl mb-2">✨</span>
                      <span className="text-sm font-extrabold leading-snug line-clamp-3">{w.title}</span>
                    </div>
                  )}
                  <p className="mt-2.5 text-[14px] font-bold leading-snug line-clamp-2">{w.title}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {fmtDate(w.sessions[0].start_time)}
                    {typeof w.price === 'number' && w.price > 0 && (
                      <span className="ml-1.5 font-bold" style={{ color: brand }}>
                        {w.price.toLocaleString('ko-KR')}원
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── 오늘 수업 ── */}
        <section>
          <div className="flex items-end justify-between mb-3.5">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: brand }}>
                Today
              </p>
              <h2 className="text-lg font-extrabold tracking-tight mt-0.5">오늘 수업</h2>
            </div>
            <Link href={`/s/${slug}/schedule`} className="text-xs font-semibold text-neutral-400 flex items-center pb-0.5">
              주간 시간표 <ChevronRight size={13} />
            </Link>
          </div>
          {todayClasses.length === 0 ? (
            <div className="py-9 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900">
              <p className="text-sm text-neutral-400">오늘 남은 수업이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayClasses.map((s) => (
                <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900">
                  <span
                    className="px-2.5 py-1.5 rounded-lg text-[13px] font-extrabold tabular-nums text-white flex-shrink-0"
                    style={{ backgroundColor: brand }}
                  >
                    {fmtTime(s.start_time)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold truncate">{s.classes?.title}</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      {[s.classes?.genre, s.classes?.instructor_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {typeof s.max_students === 'number' && (
                    <span className="text-[11px] text-neutral-400 flex-shrink-0 tabular-nums">
                      {s.current_students ?? 0}/{s.max_students}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 수강권 CTA ── */}
        <section>
          <Link
            href={`/s/${slug}/tickets`}
            className="flex items-center justify-between px-6 py-5 rounded-2xl text-white"
            style={{ backgroundImage: `linear-gradient(135deg, ${brand}, ${brand}CC)`, boxShadow: `0 12px 28px -10px ${brand}66` }}
          >
            <div>
              <p className="text-[15px] font-extrabold">수강권 보러 가기</p>
              <p className="text-xs opacity-80 mt-0.5">쿠폰 · 정기권 · 원데이</p>
            </div>
            <ArrowRight size={20} />
          </Link>
        </section>
      </div>
    </div>
  );
}
