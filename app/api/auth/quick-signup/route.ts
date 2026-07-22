import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeGuestEmail, normalizeGuestPhone } from '@/lib/utils/guest-normalize';

/**
 * Q-간편가입 (2026-07-22): 비회원이 이름+전화번호+이메일만으로 즉시 가입하고,
 * 비밀번호 생성·이메일 왕복·페이지 이탈 없이 곧바로 로그인된 계정을 얻는다.
 *
 * 흐름:
 *   1. 입력 검증 + 정규화(이메일 소문자 trim, 전화 숫자만).
 *   2. **회원 충돌 사전 검사**(계정 탈취 안전의 첫 관문):
 *      - 같은 이메일이 정식 회원(is_guest=false)에게 있으면 → EXISTS(EMAIL). 토큰 없음.
 *      - 같은 전화가 정식 회원에게 있으면 → EXISTS(PHONE). 토큰 없음.
 *        (전화에 UNIQUE 인덱스가 있어, 회원 전화와 충돌하면 createUser 가 500 으로
 *         죽는다. 친절한 EXISTS 로 먼저 잡아 로그인으로 유도한다.)
 *      - is_guest=true 행은 충돌이 아님 → 아래 createUser 시 트리거가 자동 병합.
 *   3. auth.admin.createUser({ email, email_confirm:true, user_metadata:{ name, phone } })
 *      - 사용자가 절대 보지 못하는 강력한 랜덤 비밀번호 사용.
 *      - handle_new_user 트리거가 name/phone 을 public.users 로 전파 + 게스트 병합.
 *      - **이미 등록된 이메일이면 createUser 가 422 로 실패** → EXISTS(EMAIL). 토큰 없음.
 *        (핵심 불변식: generateLink 는 createUser 성공 이후에만 호출된다. 즉 **이 요청에서
 *         방금 만든 계정**에 대해서만 토큰을 발급한다. 기존 계정에는 어떤 토큰도 나가지 않는다.)
 *   4. auth.admin.generateLink({ type:'magiclink', email }) → **token_hash 만** 반환.
 *      (action_link/refresh token 은 절대 반환하지 않는다.)
 *      클라이언트가 supabase.auth.verifyOtp({ type:'email', token_hash }) 로 세션 확립.
 *
 * 응답:
 *   400 { status:'INVALID', field }
 *   200 { status:'EXISTS', reason:'EMAIL'|'PHONE' }        // 토큰 없음
 *   200 { status:'CREATED', token_hash, email }             // 방금 만든 계정만
 *   429 { status:'RATE_LIMITED' }
 *   500 { status:'ERROR' }
 *
 * 잔여 남용 위험(정직 고지):
 *   - 이메일 소유 확인 없이 계정을 만든다(무연락 즉시 가입 요구사항의 본질). 타인의
 *     이메일로 유령 계정을 만들 수는 있으나, **세션은 그 요청자에게만** 발급되고 기존
 *     계정에는 아무 영향이 없다(EXISTS 로 차단). 실이메일 소유자는 그대로 정상 가입 가능
 *     (그 시점엔 EXISTS 로 로그인 유도됨 → 필요 시 운영자가 유령계정 정리).
 *   - 하단의 IP 기반 소프트 레이트리밋은 얇은 방어일 뿐 분산 남용은 막지 못한다.
 */

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// --- 얇은 IP 소프트 레이트리밋 (프로세스 메모리) ---------------------------------
// 서버리스 인스턴스마다 독립적이라 완벽하진 않지만, 단일 IP의 폭주는 눌러준다.
const RL_WINDOW_MS = 10 * 60 * 1000; // 10분
const RL_MAX = 20; // 창당 최대 시도
const rlBucket = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = rlBucket.get(ip);
  if (!cur || now > cur.resetAt) {
    rlBucket.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    // 가벼운 청소: 버킷이 커지면 만료분 제거
    if (rlBucket.size > 5000) {
      for (const [k, v] of rlBucket) if (now > v.resetAt) rlBucket.delete(k);
    }
    return false;
  }
  cur.count += 1;
  return cur.count > RL_MAX;
}

function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function strongRandomPassword(): string {
  // 사용자가 절대 보지 못하는 비밀번호. 충분한 엔트로피 + 문자 클래스 다양성.
  const rnd = () => Math.random().toString(36).slice(2);
  return `Qz9!${rnd()}${rnd().toUpperCase()}${rnd()}#`;
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json({ status: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = normalizeGuestEmail(body?.email);
  const phone = normalizeGuestPhone(body?.phone);

  // --- 서버측 검증 ---
  if (!name) {
    return NextResponse.json({ status: 'INVALID', field: 'name' }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ status: 'INVALID', field: 'email' }, { status: 400 });
  }
  if (!phone || phone.length < 9 || phone.length > 11) {
    return NextResponse.json({ status: 'INVALID', field: 'phone' }, { status: 400 });
  }

  const supabase = createServiceClient() as any;

  // --- 회원 충돌 사전 검사 (탈취 안전 1차 관문) ---
  try {
    const { data: emailRow } = await supabase
      .from('users')
      .select('id, is_guest')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (emailRow && emailRow.is_guest !== true) {
      return NextResponse.json({ status: 'EXISTS', reason: 'EMAIL' });
    }

    const { data: phoneRow } = await supabase
      .from('users')
      .select('id, is_guest')
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();
    if (phoneRow && phoneRow.is_guest !== true) {
      return NextResponse.json({ status: 'EXISTS', reason: 'PHONE' });
    }
  } catch (e) {
    // 사전 검사 실패는 치명적이지 않다 — createUser 단계에서 최종적으로 걸러진다.
    console.error('quick-signup precheck error:', e);
  }

  // --- 계정 생성 ---
  let createdUserId: string | null = null;
  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: strongRandomPassword(),
      user_metadata: { name, phone },
    });

    if (createErr) {
      const msg = String(createErr.message || '').toLowerCase();
      // 이미 등록된 이메일 → 절대 토큰 발급 안 함. 정상 로그인으로 유도.
      if (
        msg.includes('already been registered') ||
        msg.includes('already registered') ||
        msg.includes('email address has already') ||
        (createErr.status === 422)
      ) {
        return NextResponse.json({ status: 'EXISTS', reason: 'EMAIL' });
      }
      // 그 외(예: 회원 전화 UNIQUE 충돌로 트리거가 죽는 케이스 — 사전 검사에서
      // 대부분 잡히지만 경합으로 새는 경우) → 일반 오류.
      console.error('quick-signup createUser error:', createErr);
      return NextResponse.json({ status: 'ERROR' }, { status: 500 });
    }

    createdUserId = created?.user?.id ?? null;
    if (!createdUserId) {
      return NextResponse.json({ status: 'ERROR' }, { status: 500 });
    }
  } catch (e) {
    console.error('quick-signup createUser threw:', e);
    return NextResponse.json({ status: 'ERROR' }, { status: 500 });
  }

  // --- 세션 확립용 token_hash 발급 (방금 만든 계정에 한함) ---
  try {
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      // 토큰 발급 실패해도 계정은 이미 만들어졌다. 사용자에게는 정상 로그인으로 안내.
      console.error('quick-signup generateLink error:', linkErr);
      return NextResponse.json({ status: 'CREATED_NO_SESSION', email });
    }
    // 오직 token_hash 만 반환 — action_link/refresh token 은 절대 내보내지 않는다.
    return NextResponse.json({ status: 'CREATED', token_hash: tokenHash, email });
  } catch (e) {
    console.error('quick-signup generateLink threw:', e);
    return NextResponse.json({ status: 'CREATED_NO_SESSION', email });
  }
}
