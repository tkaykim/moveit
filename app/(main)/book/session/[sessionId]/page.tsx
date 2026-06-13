"use client";

import { useParams } from 'next/navigation';
import { SessionBookingView } from './session-booking-view';

/** 라우트 진입점: /book/session/[sessionId] — URL 파라미터의 sessionId를 뷰에 전달 */
export default function SessionBookingPage() {
  const params = useParams();
  return <SessionBookingView sessionId={params.sessionId as string} />;
}
