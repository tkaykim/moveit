import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { SessionBookingView } from '../../session/[sessionId]/session-booking-view';
import { TicketPurchaseView } from '../../ticket/ticket-purchase-view';

/**
 * 짧은 공유 링크 라우트: /book/{학원slug}/{6자리코드}
 *
 * share_code(schedules/tickets 전역 유니크)로 세션/수강권을 해석한 뒤,
 * 기존 예약 화면을 그대로 렌더한다(주소는 깔끔한 짧은 링크 그대로 유지).
 * slug는 가독성·브랜딩용이며, 실제 식별은 전역 유니크 코드로 한다.
 */
export default async function ShortBookingLinkPage({
  params,
}: {
  params: Promise<{ academySlug: string; code: string }>;
}) {
  const { code } = await params;
  const normalized = (code || '').trim().toLowerCase();
  if (!normalized) notFound();

  const supabase = createServiceClient() as any;

  const { data: session } = await supabase
    .from('schedules')
    .select('id')
    .eq('share_code', normalized)
    .maybeSingle();
  if (session?.id) {
    return <SessionBookingView sessionId={session.id} />;
  }

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('share_code', normalized)
    .maybeSingle();
  if (ticket?.id) {
    return <TicketPurchaseView ticketId={ticket.id} />;
  }

  notFound();
}
