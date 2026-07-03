import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAcademyBySlug, getPublicTickets } from '@/lib/db/miniapp';
import { describePolicies, type RefundPolicy, type PausePolicy } from '@/lib/policy/ticket-policy';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  regular: '수강권',
  popup: '팝업 클래스',
  workshop: '워크샵',
};

export default async function MiniTicketsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const academy = await getAcademyBySlug(slug);
  if (!academy) notFound();

  const tickets = await getPublicTickets(academy.id);

  const groups = new Map<string, typeof tickets>();
  for (const t of tickets) {
    const key = (t.ticket_category || 'regular').toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <div className="px-6 pt-8 pb-8">
      <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
        Pass
      </p>
      <h1 className="text-[24px] font-extrabold tracking-tight mt-0.5">수강권</h1>
      <p className="text-[13px] text-neutral-500 mt-1.5 mb-7">원하는 수강권을 골라 바로 결제할 수 있어요</p>

      {tickets.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900">
          <p className="text-sm text-neutral-400">판매 중인 수강권이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([category, list]) => (
            <section key={category}>
              <h2 className="text-[13px] font-bold text-neutral-400 mb-3">{CATEGORY_LABEL[category] || category}</h2>
              <div className="space-y-3">
                {list.map((t) => {
                  const policyLines = describePolicies({
                    refund: (t.refund_policy as RefundPolicy | null) ?? null,
                    pause: (t.pause_policy as PausePolicy | null) ?? null,
                    autoStartDays: t.auto_start_days,
                    validDays: t.valid_days,
                  });
                  const unit =
                    t.ticket_type === 'PERIOD'
                      ? t.valid_days
                        ? `${t.valid_days}일 이용`
                        : '기간제'
                      : t.total_count
                        ? `${t.total_count}회`
                        : '횟수제';
                  return (
                    <Link
                      key={t.id}
                      href={`/book/ticket?ticketId=${t.id}`}
                      className="block p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[16px] font-extrabold leading-snug">{t.name}</p>
                          <p className="text-xs font-medium text-neutral-400 mt-1">{unit}</p>
                          {t.description && (
                            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed line-clamp-2">{t.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[18px] font-extrabold tabular-nums tracking-tight" style={{ color: 'var(--primary)' }}>
                            {(t.price ?? 0).toLocaleString('ko-KR')}
                            <span className="text-[13px] font-bold">원</span>
                          </p>
                          <span
                            className="inline-flex items-center gap-0.5 mt-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: 'var(--primary)' }}
                          >
                            구매 <ChevronRight size={11} />
                          </span>
                        </div>
                      </div>
                      {policyLines.length > 0 && (
                        <ul className="mt-3.5 pt-3.5 border-t border-neutral-200/60 dark:border-neutral-800 space-y-1">
                          {policyLines.map((line) => (
                            <li key={line} className="text-[11px] text-neutral-400 leading-relaxed flex gap-1.5">
                              <span className="opacity-60">·</span> {line}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Link>
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
