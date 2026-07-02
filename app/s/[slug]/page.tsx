import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Instagram, Youtube, MapPin, MessageCircle, ChevronRight, Clock } from 'lucide-react';
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
    (s) => new Date(s.start_time) >= now && new Date(s.start_time) < todayEnd && s.classes?.class_type !== 'WORKSHOP',
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
    <div className="px-5 pt-5 space-y-8">
      {/* 소개 */}
      <section>
        <h1 className="text-2xl font-bold tracking-tight">{academy.name_kr}</h1>
        {academy.description && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
            {academy.description}
          </p>
        )}
        {academy.address && (
          <p className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300"
              >
                <Icon size={14} /> {label}
              </a>
            ))}
          </div>
        )}
      </section>

      {/* 다가오는 워크샵 */}
      {workshops.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">워크샵 · 이벤트</h2>
            <Link href={`/s/${slug}/workshops`} className="text-xs font-medium flex items-center" style={{ color: 'var(--primary)' }}>
              전체 보기 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5">
            {workshops.slice(0, 5).map((w) => (
              <Link
                key={w.id}
                href={`/s/${slug}/workshops/${w.id}`}
                className="flex-shrink-0 w-40 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
              >
                {w.poster_url || w.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.poster_url || w.thumbnail_url || ''} alt={w.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center text-3xl" style={{ backgroundColor: 'var(--primary)', opacity: 0.9 }}>
                    <span className="text-white font-bold">{w.title.slice(0, 2)}</span>
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{w.title}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{fmtDate(w.sessions[0].start_time)}</p>
                  {typeof w.price === 'number' && w.price > 0 && (
                    <p className="mt-0.5 text-xs font-bold" style={{ color: 'var(--primary)' }}>
                      {w.price.toLocaleString('ko-KR')}원
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 오늘 수업 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">오늘 수업</h2>
          <Link href={`/s/${slug}/schedule`} className="text-xs font-medium flex items-center" style={{ color: 'var(--primary)' }}>
            주간 시간표 <ChevronRight size={14} />
          </Link>
        </div>
        {todayClasses.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            오늘 남은 수업이 없습니다
          </p>
        ) : (
          <div className="space-y-2">
            {todayClasses.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex flex-col items-center justify-center w-14 flex-shrink-0">
                  <Clock size={14} className="text-neutral-400 mb-0.5" />
                  <span className="text-xs font-bold">{fmtTime(s.start_time)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{s.classes?.title}</p>
                  <p className="text-xs text-neutral-500 truncate">
                    {[s.classes?.genre, s.classes?.instructor_name].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {typeof s.max_students === 'number' && (
                  <span className="text-[11px] text-neutral-400 flex-shrink-0">
                    {s.current_students ?? 0}/{s.max_students}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 수강권 바로가기 */}
      <section className="pb-4">
        <Link
          href={`/s/${slug}/tickets`}
          className="block w-full text-center py-3.5 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          수강권 보러 가기
        </Link>
      </section>
    </div>
  );
}
