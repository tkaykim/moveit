import { notFound } from 'next/navigation';
import { getAcademyBySlug, getWorkshopById } from '@/lib/db/miniapp';
import { WorkshopSessionList } from './session-list';

export const dynamic = 'force-dynamic';

export default async function MiniWorkshopDetailPage({
  params,
}: {
  params: Promise<{ slug: string; classId: string }>;
}) {
  const { slug, classId } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();
  const workshop = await getWorkshopById(academy.id, classId);
  if (!workshop) notFound();

  return (
    <div className="pb-6">
      {(workshop.poster_url || workshop.thumbnail_url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={workshop.poster_url || workshop.thumbnail_url || ''}
          alt={workshop.title}
          className="w-full max-h-[420px] object-cover"
        />
      )}
      <div className="px-5 pt-5">
        <h1 className="text-xl font-bold leading-snug">{workshop.title}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {[workshop.genre, workshop.instructor_name].filter(Boolean).join(' · ')}
        </p>
        {typeof workshop.price === 'number' && workshop.price > 0 && (
          <p className="text-lg font-extrabold mt-2 tabular-nums" style={{ color: 'var(--primary)' }}>
            {workshop.price.toLocaleString('ko-KR')}원
          </p>
        )}
        {workshop.description && (
          <p className="mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
            {workshop.description}
          </p>
        )}

        <h2 className="text-sm font-bold mt-7 mb-2.5">일정 선택</h2>
        <WorkshopSessionList sessions={workshop.sessions} />

        <p className="mt-5 text-[11px] text-neutral-400 leading-relaxed">
          · 신청은 결제 완료 순으로 확정됩니다
          <br />· 정원 마감 시 대기 신청을 남기면 자리가 나는 대로 학원에서 연락드립니다
        </p>
      </div>
    </div>
  );
}
