# Vercel 배포 시 토스페이먼츠 환경 변수

정상 동작을 위해 **Vercel(또는 Next.js를 배포하는 환경)에 아래 환경 변수를 반드시 설정**해야 합니다.

## 토스페이먼츠 키는 어디에 두나요?

- **Supabase에는 토스 키를 두지 않습니다.**  
  Edge Function이나 Supabase 설정으로 토스 클라이언트/시크릿 키를 제공하는 구조가 아닙니다.
- **결제창·결제 승인·빌링**은 모두 **Next.js API/클라이언트**에서 처리하므로,  
  **앱이 배포되는 곳(Vercel)의 Environment Variables에 설정**해야 합니다.

(참고: [토스페이먼츠 문서] 클라이언트 키로 SDK 초기화·결제창 띄우기, 시크릿 키는 **클라이언트/GitHub 등 외부에 노출 금지**·서버에서만 결제 승인/빌링 API 호출에 사용.)

이 프로젝트는 **수강권 결제에 결제위젯**(앱 내 결제 유지), **구독·빌링에 결제창/빌링**을 사용합니다. **`NEXT_PUBLIC_TOSS_CLIENT_KEY`**, **`TOSS_SECRET_KEY`** 두 개만 설정하면 됩니다.

---

## Vercel에 설정할 변수

| 변수명 | 필수 | 용도 | 노출 |
|--------|------|------|------|
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | ✅ | **클라이언트 키.** 수강권 결제 위젯·구독·빌링 등록 (SDK 초기화) | 클라이언트 (공개용) |
| `TOSS_SECRET_KEY` | ✅ | **위 클라이언트 키와 쌍인 시크릿 키.** 결제 승인, 빌링키 발급·자동결제, 환불 등 | 서버 전용, **절대 노출 금지** |
| `TOSS_WEBHOOK_SECRET` | 선택 | 빌링 웹훅 요청 서명 검증 | 서버 전용 |

- **테스트**: `test_ck_...`, `test_sk_...` (개발자센터 API 개별 연동 테스트 키).
- **라이브**: 계약 후 발급한 라이브 클라이언트 키·시크릿 키. **클라이언트 키와 시크릿 키는 반드시 매칭된 쌍**으로 사용하세요.

설정 경로: Vercel 프로젝트 → **Settings** → **Environment Variables**  
프로덕션/프리뷰/개발 중 필요한 환경에 맞게 입력 후 **Redeploy** 하세요.

---

## 앱에서 수강권 결제 시

- 수강권 결제는 **결제위젯**을 사용합니다. 결제 방법 선택과 결제 요청이 앱 내 모달에서 이루어져 외부 브라우저로 나가지 않습니다.
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` + `TOSS_SECRET_KEY` 두 개만 있으면 됩니다.
- 결제 완료 후 success/fail 페이지도 앱 WebView에서 열리므로, Capacitor `allowNavigation` 등으로 동일하게 유지할 수 있습니다.

---

## 이 프로젝트에서 키 사용 위치

- **NEXT_PUBLIC_TOSS_CLIENT_KEY**:  
  수강권 결제 **위젯** 모달(세션 예약), 학원 구독 모달, 결제수단 카드 등록, 빌링 인증 훅
- **TOSS_SECRET_KEY**:  
  `/api/tickets/payment-confirm`, `request-billing-auth`, `subscribe`, `change-plan`, `auto-charge`(cron), `refund` 등
- **TOSS_WEBHOOK_SECRET**:  
  `api/billing/webhook` 에서 웹훅 서명이 있을 때만 검증. 없으면 서명 검증 생략

위 변수가 Vercel에 없으면 결제창이 뜨지 않거나, 결제 승인/빌링/환불이 실패합니다.
