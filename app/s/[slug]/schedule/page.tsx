import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAcademyBySlug, getWeekSchedules, type MiniScheduleItem } from '@/lib/db/miniapp';

export const dynamic = 'force-dynamic';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function seoulDay(iso: string): number {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getDay();
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });

export default async function MiniSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const { slug } = await params;
  const { w } = await searchParams;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  const offset = Math.max(-4, Math.min(8, parseInt(w || '0', 10) || 0));
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + offset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const schedules = await getWeekSchedules(academy.id, weekStart);

  const byDay = new Map<number, MiniScheduleItem[]>();
  for (const s of schedules) {
    const d = seoulDay(s.start_time);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(s);
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const rangeLabel = `${weekStart.getMonth() + 1}.${weekStart.getDate()} – ${weekEnd.getMonth() + 1}.${weekEnd.getDate()}`;
  const todayDay = now.getDay();

  return (
    <div className="px-6 pt-8 pb-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
            Weekly
          </p>
          <h1 className="text-[24px] font-extrabold tracking-tight mt-0.5">시간표</h1>
        </div>
        <div className="flex items-center gap-1 pb-0.5">
          <Link
            href={`/s/${slug}/schedule?w=${offset - 1}`}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
            aria-label="이전 주"
          >
            <ChevronLeft size={15} />
          </Link>
          <span className="px-2 text-[13px] font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">{rangeLabel}</span>
          <Link
            href={`/s/${slug}/schedule?w=${offset + 1}`}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
            aria-label="다음 주"
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900">
          <p className="text-sm text-neutral-400">이번 주 등록된 수업이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-7">
          {[0, 1, 2, 3, 4, 5, 6]
            .map((d) => ((d + 1) % 7)) // 월요일부터
            .filter((d) => byDay.has(d))
            .map((d) => {
              const isToday = offset === 0 && d === todayDay;
              return (
                <section key={d}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold ${
                        isToday ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
                      }`}
                      style={isToday ? { backgroundColor: 'var(--primary)' } : undefined}
                    >
                      {DAY_LABELS[d]}
                    </span>
                    {isToday && (
                      <span className="text-[11px] font-bold" style={{ color: 'var(--primary)' }}>
                        오늘
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {byDay.get(d)!.map((s) => {
                      const full = typeof s.max_students === 'number' && (s.current_students ?? 0) >= s.max_students;
                      return (
                        <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900">
                          <div className="w-[52px] flex-shrink-0">
                            <p className="text-[15px] font-extrabold tabular-nums leading-tight">{fmtTime(s.start_time)}</p>
                            <p className="text-[10px] text-neutral-400 tabular-nums mt-0.5">~{fmtTime(s.end_time)}</p>
                          </div>
                          <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold truncate">{s.classes?.title}</p>
                            <p className="text-xs text-neutral-500 truncate mt-0.5">
                              {[s.classes?.genre, s.classes?.difficulty_level, s.classes?.instructor_name]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          {full ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 flex-shrink-0">
                              마감
                            </span>
                          ) : (
                            typeof s.max_students === 'number' && (
                              <span className="text-[11px] text-neutral-400 flex-shrink-0 tabular-nums">
                                {s.current_students ?? 0}/{s.max_students}
                              </span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
