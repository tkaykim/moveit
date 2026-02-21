# Capacitor 앱 내 토스페이먼츠 결제 가이드

## 문제 상황

Capacitor로 감싼 앱에서 회원이 "결제하기"를 누르면:

- 새 창이 뜨면서 **외부 브라우저**(Chrome, Safari 등)로 이동
- 결제 완료 후에도 **다른 브라우저**에서 success/fail 페이지가 열림
- 결제 플로우가 끊기고, 사용자 경험이 앱 내 팝업/모달처럼 자연스럽지 않음

## 적용된 해결책 (웹/앱 통합)

### 1. window.open → 앱 내 브라우저 (@capacitor/browser)

`PaymentWindowOverride` 컴포넌트가 토스/PG 결제 URL로 열리는 `window.open`을 가로채 **앱 내 브라우저**로 엽니다.

- 웹: 기존 동작 유지 (일반 팝업)
- 앱: Custom Tabs/SFSafariViewController 형태의 모달 브라우저에서 결제 → **외부 브라우저 이탈 없음**

### 2. successUrl/failUrl 앱 딥링크 분기

앱 환경에서는 `moveit://` 딥링크를 사용합니다.

- `getPaymentSuccessUrl()`, `getPaymentFailUrl()`: `lib/capacitor/env.ts`
- MainActivity가 `moveit://payment/...` 수신 시 → https 웹 URL로 변환해 WebView에 로드
- **앱 상태 유지**, 화면 깜빡임 최소화

### 3. Intent 인터셉트 (PaymentAwareWebViewClient)

`intent://`, `ispmobile://`, `kb-acp://` 등 금융 앱 스킴을 가로채 **해당 앱만** 실행합니다. 기본 브라우저가 열리지 않습니다.

### 4. appScheme

카드사/은행 앱 인증 후 `moveit://` 스킴으로 복귀 (토스 WebView 가이드).

### 5. Android 딥링크 및 queries

- `moveit://` intent-filter
- ISP/국민/신한/카카오/토스 등 `<queries>` 등록

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|-----------|
| `lib/capacitor/env.ts` | `getPaymentSuccessUrl`, `getPaymentFailUrl`, `APP_SCHEME` |
| `lib/capacitor/payment-window-override.tsx` | `window.open` → `Browser.open` (결제 URL만) |
| `app/layout.tsx` | `PaymentWindowOverride` 마운트 |
| `android/.../MainActivity.java` | moveit:// 처리, PaymentAwareWebViewClient 주입 |
| `android/.../PaymentAwareWebViewClient.java` | intent/ispmobile 등 스킴 인터셉트 |
| `app/(main)/book/session/[sessionId]/page.tsx` | `getPaymentSuccessUrl`, `getPaymentFailUrl` |
| `lib/billing/use-toss-billing-auth.ts` | `getPaymentSuccessUrl`, `getPaymentFailUrl`, `appScheme` |
| `app/academy-admin/components/subscribe-modal.tsx` | `getPaymentSuccessUrl`, `getPaymentFailUrl`, `appScheme` |
| `app/academy-admin/components/views/billing/payment-method-card.tsx` | `getPaymentSuccessUrl`, `getPaymentFailUrl`, `appScheme` |
| `android/app/src/main/AndroidManifest.xml` | `moveit://` intent-filter, `<queries>` |

## iOS 빌드 시 추가 설정

iOS에서 결제를 사용할 경우:

1. **Info.plist**에 `LSApplicationQueriesSchemes` 추가 (카드사/은행 앱 스킴)
2. **URL Types**에 `moveit` 스킴 등록 (`moveit://` 복귀용)

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>supertoss</string>
  <string>kakaobank</string>
  <string>kb-acp</string>
  <string>ispmobile</string>
</array>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>moveit</string></array>
    <key>CFBundleURLName</key>
    <string>MOVE.IT</string>
  </dict>
</array>
```

## 참고

- [토스페이먼츠 WebView 연동 가이드](https://docs.tosspayments.com/guides/v2/webview)
- [토스페이먼츠 appScheme 문의](https://techchat.tosspayments.com/m/1031154893110644736)
- [Capacitor InAppBrowser](https://capacitorjs.com/docs/apis/inappbrowser)
