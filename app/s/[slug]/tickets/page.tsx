import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAcademyBySlug, getPublicTickets } from '@/lib/db/miniapp';
import { describePolicies, type RefundPolicy, type PausePolicy } from '@/lib/policy/ticket-policy';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  regular: '정규 수강권',
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
    <div className="px-5 pt-5 pb-6">
      <h1 className="text-xl font-bold mb-1">수강권</h1>
      <p className="text-xs text-neutral-500 mb-5">원하는 수강권을 선택하면 바로 구매할 수 있습니다</p>

      {tickets.length === 0 ? (
        <p className="text-sm text-neutral-500 py-16 text-center">판매 중인 수강권이 없습니다</p>
      ) : (
        <div className="space-y-7">
          {[...groups.entries()].map(([category, list]) => (
            <section key={category}>
              <h2 className="text-sm font-bold text-neutral-500 mb-2.5">{CATEGORY_LABEL[category] || category}</h2>
              <div className="space-y-2.5">
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
                        ? `${t.valid_days}일`
                        : '기간제'
                      : t.total_count
                        ? `${t.total_count}회`
                        : '횟수제';
                  return (
                    <Link
                      key={t.id}
                      href={`/book/ticket?ticketId=${t.id}`}
                      className="block p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 active:bg-neutral-50 dark:active:bg-neutral-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">{t.name}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{unit}</p>
                          {t.description && <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{t.description}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-extrabold tabular-nums" style={{ color: 'var(--primary)' }}>
                            {(t.price ?? 0).toLocaleString('ko-KR')}원
                          </p>
                          <span className="inline-flex items-center text-[11px] text-neutral-400 mt-1">
                            구매하기 <ChevronRight size={12} />
                          </span>
                        </div>
                      </div>
                      {policyLines.length > 0 && (
                        <ul className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-0.5">
                          {policyLines.map((line) => (
                            <li key={line} className="text-[11px] text-neutral-400 leading-relaxed">
                              · {line}
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
