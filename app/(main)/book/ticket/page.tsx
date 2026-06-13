"use client";

import { useSearchParams } from 'next/navigation';
import { TicketPurchaseView } from './ticket-purchase-view';

/** 라우트 진입점: /book/ticket?ticketId= — 쿼리의 ticketId를 뷰에 전달 */
export default function TicketPurchaseLinkPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId') || searchParams.get('ticket_id');
  return <TicketPurchaseView ticketId={ticketId} />;
}
