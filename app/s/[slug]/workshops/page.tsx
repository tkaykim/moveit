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
    <div className="px-5 pt-5 pb-6">
      <h1 className="text-xl font-bold mb-1">워크샵 · 이벤트</h1>
      <p className="text-xs text-neutral-500 mb-5">신청은 선착순이며, 정원이 차면 대기 신청을 받을 수 있습니다</p>

      {workshops.length === 0 ? (
        <p className="text-sm text-neutral-500 py-16 text-center">예정된 워크샵이 없습니다</p>
      ) : (
        <div className="space-y-3">
          {workshops.map((w) => {
            const first = w.sessions[0];
            const totalSeats = w.sessions.reduce((acc, s) => acc + (s.max_students ?? 0), 0);
            const takenSeats = w.sessions.reduce((acc, s) => acc + (s.current_students ?? 0), 0);
            const full = totalSeats > 0 && takenSeats >= totalSeats;
            return (
              <Link
                key={w.id}
                href={`/s/${slug}/workshops/${w.id}`}
                className="flex gap-3.5 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 active:bg-neutral-50 dark:active:bg-neutral-900"
              >
                {w.poster_url || w.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.poster_url || w.thumbnail_url || ''} alt={w.title} className="w-20 h-24 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-24 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold" style={{ backgroundColor: 'var(--primary)' }}>
                    {w.title.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-sm font-bold leading-snug line-clamp-2">{w.title}</p>
                  {w.instructor_name && <p className="text-xs text-neutral-500 mt-0.5">{w.instructor_name}</p>}
                  <p className="text-xs text-neutral-500 mt-1.5">
                    {fmtDate(first.start_time)} {fmtTime(first.start_time)}
                    {w.sessions.length > 1 && ` 외 ${w.sessions.length - 1}회`}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {typeof w.price === 'number' && w.price > 0 && (
                      <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>
                        {w.price.toLocaleString('ko-KR')}원
                      </span>
                    )}
                    {full && <span className="text-[11px] font-semibold text-red-500">정원 마감 · 대기 접수</span>}
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
