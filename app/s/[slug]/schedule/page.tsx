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

  // 주 오프셋 (0=이번 주)
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
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">시간표</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/s/${slug}/schedule?w=${offset - 1}`} className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800" aria-label="이전 주">
            <ChevronLeft size={16} />
          </Link>
          <span className="px-2 font-medium text-neutral-600 dark:text-neutral-300 tabular-nums">{rangeLabel}</span>
          <Link href={`/s/${slug}/schedule?w=${offset + 1}`} className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800" aria-label="다음 주">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {schedules.length === 0 ? (
        <p className="text-sm text-neutral-500 py-16 text-center">이번 주 등록된 수업이 없습니다</p>
      ) : (
        <div className="space-y-6 pb-6">
          {[0, 1, 2, 3, 4, 5, 6]
            .map((d) => ((d + 1) % 7)) // 월요일부터 표시
            .filter((d) => byDay.has(d))
            .map((d) => (
              <section key={d}>
                <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${offset === 0 && d === todayDay ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
                    style={offset === 0 && d === todayDay ? { backgroundColor: 'var(--primary)' } : undefined}
                  >
                    {DAY_LABELS[d]}
                  </span>
                  {offset === 0 && d === todayDay && <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>오늘</span>}
                </h2>
                <div className="space-y-2">
                  {byDay.get(d)!.map((s) => {
                    const full = typeof s.max_students === 'number' && (s.current_students ?? 0) >= s.max_students;
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                        <div className="w-20 flex-shrink-0">
                          <p className="text-sm font-bold tabular-nums">{fmtTime(s.start_time)}</p>
                          <p className="text-[11px] text-neutral-400 tabular-nums">~{fmtTime(s.end_time)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{s.classes?.title}</p>
                          <p className="text-xs text-neutral-500 truncate">
                            {[s.classes?.genre, s.classes?.difficulty_level, s.classes?.instructor_name].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        {full ? (
                          <span className="text-[11px] font-semibold text-red-500 flex-shrink-0">마감</span>
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
            ))}
        </div>
      )}
    </div>
  );
}
