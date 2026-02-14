import crypto from 'crypto';

const QR_TOKEN_EXPIRY_SECONDS = 180; // 3분

function getSecretKey(): string {
  const key = process.env.QR_SECRET_KEY || process.env.NEXTAUTH_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('QR_SECRET_KEY 환경변수가 설정되지 않았습니다.');
  }
  return key;
}

/**
 * QR 토큰 생성
 * 포맷: compactBookingId.timestampHex.signatureShort
 * 
 * 예시: "a1b2c3d4e5f6...".  "67890abc" . "3f8a1b2c"
 * 총 길이: 32 + 1 + 8 + 1 + 8 = 약 50자 (QR Version 3, 매우 sparse)
 */
export function generateQrToken(bookingId: string, userId: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = getSecretKey();

  // bookingId에서 하이픈 제거하여 32자로 압축
  const compactId = bookingId.replace(/-/g, '');
  const tsHex = timestamp.toString(16); // 10진수 10자리 → 16진수 8자리

  const message = `${compactId}:${userId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
    .substring(0, 8);

  // 점(.) 구분자로 짧은 토큰 생성 (~50자)
  return `${compactId}.${tsHex}.${signature}`;
}

interface VerifyResult {
  valid: boolean;
  bookingId?: string;
  userId?: string;
  error?: string;
}

/**
 * 압축된 bookingId를 원래 UUID 형식으로 복원
 * 32자 hex → 8-4-4-4-12 형식
 */
function restoreUuid(compact: string): string {
  if (compact.length !== 32) return compact;
  return [
    compact.substring(0, 8),
    compact.substring(8, 12),
    compact.substring(12, 16),
    compact.substring(16, 20),
    compact.substring(20, 32),
  ].join('-');
}

/**
 * QR 토큰 검증
 * 1. 파싱 (compactBookingId.timestampHex.signature)
 * 2. bookingId로 DB에서 userId 조회 필요 (호출자가 처리)
 * 3. 만료 시간 확인 (3분)
 * 
 * 참고: userId는 QR에 포함하지 않으므로, 호출자가 DB에서 조회하여
 * verifyQrTokenSignature()로 서명을 최종 검증해야 합니다.
 */
export function verifyQrToken(tokenString: string): VerifyResult {
  try {
    const parts = tokenString.split('.');

    if (parts.length !== 3) {
      return { valid: false, error: '토큰 형식이 올바르지 않습니다.' };
    }

    const [compactId, tsHex, signature] = parts;

    if (!compactId || !tsHex || !signature) {
      return { valid: false, error: '토큰 형식이 올바르지 않습니다.' };
    }

    const timestamp = parseInt(tsHex, 16);
    if (isNaN(timestamp)) {
      return { valid: false, error: '토큰 형식이 올바르지 않습니다.' };
    }

    // 만료 시간 확인
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > QR_TOKEN_EXPIRY_SECONDS) {
      return { valid: false, error: 'QR 코드가 만료되었습니다. 새로운 QR 코드를 생성해주세요.' };
    }

    // bookingId 복원
    const bookingId = restoreUuid(compactId);

    // 이 단계에서는 userId를 모르므로 서명 검증은 보류
    // 호출자가 DB에서 booking.user_id를 조회한 뒤 verifyQrTokenSignature() 호출
    return {
      valid: true,
      bookingId,
      // userId는 DB 조회 후 설정
    };
  } catch {
    return { valid: false, error: 'QR 코드를 읽을 수 없습니다.' };
  }
}

/**
 * DB에서 userId를 조회한 후 서명을 최종 검증
 */
export function verifyQrTokenSignature(
  tokenString: string,
  userId: string
): boolean {
  try {
    const parts = tokenString.split('.');
    if (parts.length !== 3) return false;

    const [compactId, tsHex, signature] = parts;
    const timestamp = parseInt(tsHex, 16);

    const secret = getSecretKey();
    const message = `${compactId}:${userId}:${timestamp}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex')
      .substring(0, 8);

    return signature === expectedSignature;
  } catch {
    return false;
  }
}
