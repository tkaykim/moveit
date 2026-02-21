# Capacitor 앱 내 토스페이먼츠 결제 가이드

## 문제 상황

Capacitor로 감싼 앱에서 회원이 "결제하기"를 누르면:

- 새 창이 뜨면서 **외부 브라우저**(Chrome, Safari 등)로 이동
- 결제 완료 후에도 **다른 브라우저**에서 success/fail 페이지가 열림
- 결제 플로우가 끊기고, 사용자 경험이 앱 내 팝업/모달처럼 자연스럽지 않음

## 원인

1. **토스페이먼츠 SDK**의 `requestPayment` / `requestBillingAuth`는 결제 시:
   - `window.open()`(팝업) 또는 **현재 창 redirect** 사용
   - Capacitor WebView에서 `window.open`이 시스템 브라우저로 열리는 경우가 있음
2. **카드사 앱 앱투앱** 시: ISP, 카카오뱅크 등 외부 앱 인증 후 **앱으로 복귀**할 스킴이 없음
3. **Android 11+** 패키지 가시성: 카드사 앱 패키지 미등록 시 Play Store로만 연결됨

## 적용된 해결책

### 1. appScheme 추가 (필수)

토스페이먼츠 [`WebView 연동 가이드`](https://docs.tosspayments.com/guides/v2/webview)에 따라 **appScheme**을 모든 결제 요청에 추가했습니다.

- **역할**: 카드사/은행 앱 인증 후 `moveit://` 스킴으로 우리 앱으로 복귀
- **적용 위치**:
  - `requestPayment`: 수강권 결제 (세션 예약 시 카드/계좌결제)
  - `requestBillingAuth`: 구독 카드 등록, 빌링키 발급

```ts
...(isCapacitorNative() && { appScheme: APP_SCHEME })
```

- `APP_SCHEME = 'moveit://'`
- `isCapacitorNative()`: `window.Capacitor?.isNativePlatform?.()`로 앱 실행 여부 판별

### 2. Android 딥링크(Intent Filter) 등록

`AndroidManifest.xml`에 `moveit://` 스킴을 처리할 intent-filter 추가:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="moveit" android:host="*" android:pathPrefix="/" />
</intent-filter>
```

### 3. Android 카드사 앱 패키지 queries

Android 11+에서는 `<queries>`에 카드사/은행 앱 패키지를 등록해야, 해당 앱으로 이동했다가 다시 복귀할 수 있습니다. 미등록 시 Play Store로만 이동할 수 있어 결제 흐름이 끊깁니다.

- ISP/BC/국민, 신한, 카카오뱅크, 토스페이 등 주요 패키지 추가
- 상세 목록은 [토스 WebView 가이드](https://docs.tosspayments.com/guides/v2/webview) 참고

## 추가 권장 조치 (결제창이 여전히 외부 브라우저로 열리는 경우)

### A. window.open → 앱 내 브라우저로 열기

토스 결제창이 `window.open()`으로 열릴 경우, 이를 **앱 내 WebView**로 처리하는 방법입니다.

1. **@capacitor/inappbrowser** 또는 **@capacitor/browser** 설치
2. 앱 초기화 시점에 `window.open` 오버라이드:

```ts
// app/layout.tsx 또는 _app.tsx 등
if (typeof window !== 'undefined' && isCapacitorNative()) {
  const orig = window.open;
  window.open = function(url: string, target?: string, features?: string) {
    if (url && /tosspayments|toss\.im|portone/i.test(url)) {
      InAppBrowser.openInWebView({ url });
      return null;
    }
    return orig.call(window, url, target, features);
  };
}
```

- Toss 결제 URL 패턴은 실제 동작 관찰 후 보완 필요
- 다른 팝업에 영향이 없도록 조건을 좁게 잡는 것이 좋음

### B. 결제위젯(Payment Widget) 전환

`requestPayment` 대신 **결제위젯**을 사용하면, 결제 UI가 **페이지 내 div**에 렌더링됩니다.

- 팝업/새 창 문제를 피할 수 있음
- 카드사 인증 등 일부 플로우는 여전히 리다이렉트 또는 앱투앱 발생
- 연동 방식 변경이 필요하므로 중장기 과제로 검토

### C. iOS 설정 (iOS 빌드 시)

iOS에서 결제를 사용할 경우:

1. **Info.plist**에 `LSApplicationQueriesSchemes` 추가  
   - 카드사/은행 앱 스킴 등록
2. **URL Types**에 `moveit` 스킴 등록  
   - `moveit://`로 복귀 시 앱 실행

예시:

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>supertoss</string>
  <string>kakaobank</string>
  <string>kb-acp</string>
  <string>ispmobile</string>
  <!-- 기타 필요 스킴 -->
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

## 파일 변경 요약

| 파일 | 변경 내용 |
|------|-----------|
| `lib/capacitor/env.ts` | `isCapacitorNative()`, `APP_SCHEME` |
| `app/(main)/book/session/[sessionId]/page.tsx` | `requestPayment`에 `appScheme` |
| `lib/billing/use-toss-billing-auth.ts` | `requestBillingAuth`에 `appScheme` |
| `app/academy-admin/components/subscribe-modal.tsx` | `requestBillingAuth`에 `appScheme` |
| `app/academy-admin/components/views/billing/payment-method-card.tsx` | `requestBillingAuth`에 `appScheme` |
| `android/app/src/main/AndroidManifest.xml` | `moveit://` intent-filter, `<queries>` |

## 참고

- [토스페이먼츠 WebView 연동 가이드](https://docs.tosspayments.com/guides/v2/webview)
- [토스페이먼츠 appScheme 문의](https://techchat.tosspayments.com/m/1031154893110644736)
- [Capacitor InAppBrowser](https://capacitorjs.com/docs/apis/inappbrowser)
