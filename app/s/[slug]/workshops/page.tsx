import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAcademyBySlug, getUpcomingWorkshops } from '@/lib/db/miniapp';

export const dynamic = 'force-dynamic';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });

export default async function MiniWorkshopsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  const workshops = await getUpcomingWorkshops(academy.id);

  return (
    <div className="px-6 pt-8 pb-8">
      <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
        Special
      </p>
      <h1 className="text-[24px] font-extrabold tracking-tight mt-0.5">워크샵 · 이벤트</h1>
      <p className="text-[13px] text-neutral-500 mt-1.5 mb-7">선착순 마감 — 정원이 차면 대기 신청을 받아요</p>

      {workshops.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900">
          <p className="text-sm text-neutral-400">예정된 워크샵이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {workshops.map((w) => {
            const first = w.sessions[0];
            const totalSeats = w.sessions.reduce((acc, s) => acc + (s.max_students ?? 0), 0);
            const takenSeats = w.sessions.reduce((acc, s) => acc + (s.current_students ?? 0), 0);
            const full = totalSeats > 0 && takenSeats >= totalSeats;
            return (
              <Link
                key={w.id}
                href={`/s/${slug}/workshops/${w.id}`}
                className="flex gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 active:scale-[0.99] transition-transform"
              >
                {w.poster_url || w.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.poster_url || w.thumbnail_url || ''}
                    alt={w.title}
                    className="w-[88px] h-[112px] rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-[88px] h-[112px] rounded-xl flex items-center justify-center flex-shrink-0 text-white text-2xl"
                    style={{ backgroundImage: 'linear-gradient(150deg, var(--primary), color-mix(in srgb, var(--primary) 60%, transparent))' }}
                  >
                    ✨
                  </div>
                )}
                <div className="min-w-0 flex-1 py-1">
                  <p className="text-[15px] font-extrabold leading-snug line-clamp-2">{w.title}</p>
                  {w.instructor_name && <p className="text-xs text-neutral-500 mt-1">{w.instructor_name}</p>}
                  <p className="text-xs text-neutral-500 mt-2">
                    {fmtDate(first.start_time)} {fmtTime(first.start_time)}
                    {w.sessions.length > 1 && ` 외 ${w.sessions.length - 1}회`}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {typeof w.price === 'number' && w.price > 0 && (
                      <span className="text-[15px] font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>
                        {w.price.toLocaleString('ko-KR')}원
                      </span>
                    )}
                    {full ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
                        마감 · 대기 접수
                      </span>
                    ) : (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)' }}
                      >
                        선착순 모집 중
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
