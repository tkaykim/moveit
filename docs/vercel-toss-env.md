# Vercel 배포 시 토스페이먼츠 환경 변수

정상 동작을 위해 **Vercel(또는 Next.js를 배포하는 환경)에 아래 환경 변수를 반드시 설정**해야 합니다.

## 토스페이먼츠 키는 어디에 두나요?

- **Supabase에는 토스 키를 두지 않습니다.**  
  Edge Function이나 Supabase 설정으로 토스 클라이언트/시크릿 키를 제공하는 구조가 아닙니다.
- **결제창·결제 승인·빌링**은 모두 **Next.js API/클라이언트**에서 처리하므로,  
  **앱이 배포되는 곳(Vercel)의 Environment Variables에 설정**해야 합니다.

(참고: [토스페이먼츠 문서] 클라이언트 키로 SDK 초기화·결제창 띄우기, 시크릿 키는 **클라이언트/GitHub 등 외부에 노출 금지**·서버에서만 결제 승인/빌링 API 호출에 사용.)

**결제위젯 vs API 개별 연동 키:**  
결제위젯은 **결제위젯 연동 키**로만 SDK 연동해야 합니다. API 개별 연동 키를 쓰면 `NOT_SUPPORTED_API_INDIVIDUAL_KEY` 에러가 납니다. 자세한 구분은 [toss-api-keys-guide.md](./toss-api-keys-guide.md) 참고.

---

## Vercel에 설정할 변수

| 변수명 | 필수 | 용도 | 노출 |
|--------|------|------|------|
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | ✅ | **API 개별 연동 키.** 결제창·빌링 등록창 (SDK 초기화) | 클라이언트 (공개용) |
| `TOSS_SECRET_KEY` | ✅ | **위 클라이언트 키와 쌍인 시크릿 키.** 결제 승인, 빌링키 발급·자동결제, 환불 등 | 서버 전용, **절대 노출 금지** |
| `NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY` | 선택 (현재 미사용) | 결제위젯 연동 키. 수강권 결제는 **결제창만** 사용하므로 설정하지 않아도 됨 | 클라이언트 (공개용) |
| `TOSS_WIDGET_SECRET_KEY` | 선택 | 결제위젯 연동 키와 쌍인 시크릿. 위젯 사용 시에만 | 서버 전용, **절대 노출 금지** |
| `TOSS_WEBHOOK_SECRET` | 선택 | 빌링 웹훅 요청 서명 검증 | 서버 전용 |

- **테스트**: `test_ck_...`, `test_sk_...` (개발자센터 또는 문서 테스트 키). 결제위젯용은 개발자센터에서 **결제위젯 연동 키** 확인.
- **라이브**: 계약 후 발급한 라이브 클라이언트 키·시크릿 키. **클라이언트 키와 시크릿 키는 반드시 매칭된 쌍**으로 사용하세요.

설정 경로: Vercel 프로젝트 → **Settings** → **Environment Variables**  
프로덕션/프리뷰/개발 중 필요한 환경에 맞게 입력 후 **Redeploy** 하세요.

---

## 앱에서 수강권 결제 시 외부 브라우저로 나가지 않게 하려면?

- **필요한 건 `NEXT_PUBLIC_TOSS_CLIENT_KEY` + `TOSS_SECRET_KEY` 뿐입니다.** 위젯 키는 넣지 않아도 됩니다.
- 수강권 결제는 **결제창**만 사용합니다. Android 앱에서는 결제창이 **앱 내 오버레이**에서만 열리고, 결제 완료 후 success/fail 페이지도 **앱 WebView**에서 열리므로 외부 브라우저로 나가지 않습니다 (Capacitor `allowNavigation` + `MoveitWebChromeClient` 처리).

---

## 이 프로젝트에서 키 사용 위치

- **NEXT_PUBLIC_TOSS_CLIENT_KEY** (API 개별 연동 키):  
  수강권 결제창, 학원 구독 모달, 결제수단 카드 등록, 빌링 인증 훅
- **NEXT_PUBLIC_TOSS_WIDGET_CLIENT_KEY**:  
  현재 수강권 결제에서는 사용하지 않음. (나중에 위젯 UI를 쓸 경우에만 설정)
- **TOSS_SECRET_KEY**:  
  `payment-confirm`, `request-billing-auth`, `subscribe`, `change-plan`, `auto-charge`(cron), `refund` 등 API. (위젯으로 결제한 건은 개발자센터에 따라 `TOSS_WIDGET_SECRET_KEY` 분기 필요할 수 있음.)
- **TOSS_WEBHOOK_SECRET**:  
  `api/billing/webhook` 에서 웹훅 서명이 있을 때만 검증. 없으면 서명 검증 생략.

위 변수가 Vercel에 없으면 결제창이 뜨지 않거나, 결제 승인/빌링/환불이 실패합니다.
