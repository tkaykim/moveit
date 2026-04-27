/**
 * 예약번호 단축 표시 — 사용자·운영자 소통용.
 *
 * B-4 (2026-04-27): Supabase UUID는 보안상 우수하지만 사람이 읽고 전달하기엔
 * 너무 길다(36자). 학원과 학생이 전화·메일·DM으로 예약을 식별할 때 부담이 큼.
 *
 * 변환식: UUID 첫 8자리 → 대문자 → "BK-" prefix.
 * 예) `10adb5e6-3a5d-4ee8-...` → `BK-10ADB5E6`
 *
 * 충돌 가능성: 16^8 ≈ 약 42억. 학원 1곳 단위에서 실용적 충돌 0.
 * 향후 DB에 `booking_code` 컬럼을 도입하면 그쪽이 단일 진실 소스가 됨.
 *
 * 동일 변환식을 admin enrollments-view, success 화면, 활동 로그 등에서
 * 일관 사용해야 한다 (헬퍼를 import하지 말고 inline하지 말 것).
 */
export function formatBookingCode(id: string | null | undefined): string {
  if (!id) return '';
  const short = String(id).replace(/-/g, '').slice(0, 8).toUpperCase();
  return `BK-${short}`;
}
