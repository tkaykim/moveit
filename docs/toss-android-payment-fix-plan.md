# 토스페이먼츠 Capacitor 앱 결제 수단 전체 정상화 — 원인 분석 & 구현 계획

> 참고 문서: https://docs.tosspayments.com/guides/v2/payment-window/integration-direct
> 작성 기준: 2026-02-22 / 코드베이스 직접 분석 결과

---

## 1. 현황 요약

| 결제 수단 | 현재 상태 | 원인 |
|----------|-----------|------|
| 카카오페이 | ✅ 정상 | `window.open()` → 오버레이 WebView → 카카오 앱 → `moveitapp://` 복귀 후 오버레이 제거 흐름이 우연히 맞물림 |
| 카드 결제 | ❌ 앱으로 안 넘어가거나, 넘어가도 결제 정보 없음 | 아래 4가지 버그 |
| 결제 취소 후 재시도 | ❌ 모달이 닫혀 세션 소실 | `onError` 콜백이 취소/실패를 구분 않고 모달 닫음 |

---

## 2. 버그 원인 상세 분석

### Bug A — 결제 취소 시 세션 소실

**흐름:**
```
사용자 "결제하기" 클릭
  → widgets.requestPayment() 호출
  → 사용자가 결제창에서 "취소" 또는 뒤로가기
  → Toss SDK: { code: 'PAY_PROCESS_CANCELED', message: '...' } throw
  → handleRequestPayment catch → onError(msg) 호출
  → session/[sessionId]/page.tsx onError: setWidgetModalOpen(false) + setWidgetOrder(null)
  → 모달 닫힘 → orderId·amount 등 주문 정보 소실
```

**문제:**
`ticket-toss-payment-modal.tsx`의 catch 블록이 취소(`PAY_PROCESS_CANCELED`)와 실제 에러를 구분하지 않고 동일하게 `onError()` 를 호출한다.
`onError`는 호출 측에서 모달을 닫도록 구현되어 있어 취소 후 재시도가 불가능하다.

**Toss SDK 취소 에러 코드:**
- `PAY_PROCESS_CANCELED` — 사용자가 직접 결제 취소
- `PAY_PROCESS_ABORTED` — 결제 프로세스 중단(네트워크 등)

---

### Bug B — `resolveActivity()` Android 11+ 패키지 가시성 문제

**흐름:**
```
오버레이/메인 WebView에서 intent:// URL 인터셉트
  → Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
  → intent.resolveActivity(getPackageManager())  ← Android 11+에서 null 반환
  → resolveActivity == null → fallback URL 시도 또는 return false
  → 카드사 앱이 실제로 설치되어 있어도 실행 안 됨
```

**문제:**
Android 11(API 30)부터 `resolveActivity()`는 `<queries>` 또는 `<intent>` 스킴 선언이 없으면 **설치된 앱이라도 null**을 반환한다.
현재 `AndroidManifest.xml`의 `<queries>`는 패키지명(package)은 일부 선언했지만, **scheme 기반 intent filter(`ispmobile://`, `hdcardappcardansimclick://` 등)가 없다.**
결과: 카드사 앱이 설치되어 있어도 intent를 실행하지 못하고 fallback으로 빠짐.

---

### Bug C — 오버레이 WebView가 `moveitapp://` 복귀 후 남아 있음

**흐름 (카드 결제 + window.open() 발생 시):**
```
Toss 결제창에서 ISP/페이북 인증 등 window.open() 발생
  → MoveitWebChromeClient.onCreateWindow() → 오버레이 WebView 생성
  → 오버레이 내 intent:// URL → 카드사 앱 실행
  → 카드사 앱 결제 완료 → moveitapp://payment/ticket/success?... 딥링크 호출
  → MainActivity.onNewIntent() → handleMoveitAppScheme()
  → 메인 WebView에 success URL 로드 ← 여기까지는 OK
  → 하지만 오버레이 WebView는 여전히 화면 위에 남아 있음!
  → 성공 화면이 오버레이에 가려져 보이지 않음
```

**문제:**
`handleMoveitAppScheme()`은 메인 WebView에 URL만 로드할 뿐, `MoveitWebChromeClient`의 오버레이를 제거하지 않는다.
오버레이 제거 로직(`removeOverlay()`)은 **오버레이 내부 WebView가 우리 도메인으로 이동할 때만** 실행된다.
카드사 앱에서 직접 `moveitapp://`로 복귀하면 오버레이 WebView는 아무 이벤트도 받지 못하므로 제거되지 않는다.

카카오페이가 작동하는 이유: 카카오페이는 앱 복귀 후 카카오 측에서 오버레이 WebView 내부에 우리 도메인 URL로 redirect하는 경우가 있어, `handleOverlayUrl`의 `appHost` 체크가 우연히 실행된다.

---

### Bug D — 오버레이 WebView 설정 누락

`MoveitWebChromeClient.onCreateWindow()`에서 생성하는 오버레이 WebView에 다음 설정이 없다:

```java
// 누락된 설정
overlayWebView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
```

`setSupportMultipleWindows(true)` 만 있고 `setJavaScriptCanOpenWindowsAutomatically(true)` 가 없으면, 오버레이 내부에서 JavaScript로 `window.open()` 호출 시 제대로 동작하지 않는다.
ISP/페이북 같이 중간에 또 다른 팝업을 여는 결제 수단에서 문제가 발생한다.

---

## 3. 구현 계획

### 수정 파일 목록

| 파일 | 수정 이유 |
|------|-----------|
| `components/modals/ticket-toss-payment-modal.tsx` | Bug A 수정: 취소/에러 구분 |
| `android/app/src/main/AndroidManifest.xml` | Bug B 수정: 카드사 URL 스킴 intent 필터 추가 |
| `android/app/src/main/java/com/moveit/app/MoveitWebChromeClient.java` | Bug C·D 수정: 오버레이 정리 메서드 공개 + 설정 추가 + try-catch |
| `android/app/src/main/java/com/moveit/app/MoveitBridgeWebViewClient.java` | Bug B 수정: resolveActivity → try-catch |
| `android/app/src/main/java/com/moveit/app/MainActivity.java` | Bug C 수정: moveitapp:// 처리 시 오버레이 제거 |

---

### 수정 1: `ticket-toss-payment-modal.tsx` — 취소 시 모달 유지

**현재 코드 (`handleRequestPayment` catch 블록):**
```typescript
} catch (e: any) {
  const msg = e?.message ?? '결제 요청에 실패했습니다.';
  // ... 에러 메시지 가공
  onError(isPhoneFormatError ? '...' : msg);
} finally {
  setPaying(false);
}
```

**변경 내용:**
- `e?.code`가 `PAY_PROCESS_CANCELED` 또는 `PAY_PROCESS_ABORTED`이면 `onError()` 호출 금지
- 대신 모달 내부에 인라인 안내 메시지 상태(`cancelMsg`)를 표시하고 모달 유지
- 3초 후 `cancelMsg` 자동 소거 (선택)
- 실제 오류(네트워크, 서버 거절 등)는 기존대로 `onError()` 호출

**추가 state:**
```typescript
const [cancelMsg, setCancelMsg] = useState('');
```

**catch 블록 변경:**
```typescript
} catch (e: any) {
  const code = e?.code ?? '';
  const isCancelled =
    code === 'PAY_PROCESS_CANCELED' || code === 'PAY_PROCESS_ABORTED';

  if (isCancelled) {
    // 모달 유지 — 사용자가 바로 재시도 가능
    setCancelMsg('결제가 취소되었습니다. 다시 시도해주세요.');
    setTimeout(() => setCancelMsg(''), 3000);
    return; // onError 호출 안 함
  }

  const msg = e?.message ?? '결제 요청에 실패했습니다.';
  const isPhoneFormatError =
    typeof msg === 'string' &&
    msg.includes('전화번호') &&
    (msg.includes('특수문자') || msg.includes('형식'));
  onError(isPhoneFormatError ? '전화번호는 하이픈(-) 없이 숫자만 입력해주세요.' : msg);
} finally {
  setPaying(false);
}
```

**UI에 cancelMsg 표시:**
결제 버튼 아래 또는 위에 `{cancelMsg && <p className="text-sm text-amber-500 text-center">{cancelMsg}</p>}` 추가

---

### 수정 2: `AndroidManifest.xml` — 카드사 URL 스킴 intent 필터 추가

`<queries>` 블록에 기존 `<package>` 목록 유지하면서 `<intent>` 기반 스킴 선언 추가:

```xml
<queries>
  <!-- 기존 패키지 선언 유지 -->
  <package android:name="com.kakao.talk" />
  <package android:name="viva.republica.toss" />
  <!-- ... 기존 항목들 ... -->

  <!-- 카드사 앱 scheme 기반 가시성 (Android 11+) -->
  <!-- Toss WebView 가이드 권장 scheme 목록 -->
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="ispmobile" />          <!-- ISP/페이북 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="hdcardappcardansimclick" />  <!-- 현대카드 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="shinhan-sr-ansimclick" />    <!-- 신한카드 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="kb-acp" />                   <!-- KB국민카드 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="lotteappcard" />              <!-- 롯데카드 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="hanamopmoasign" />            <!-- 하나카드 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="mpocket.online.ansimclick" /> <!-- 삼성카드 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="kakaotalk" />                 <!-- 카카오페이 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="supertoss" />                 <!-- 토스 간편결제 -->
  </intent>
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="naversearchapp" />            <!-- 네이버페이 -->
  </intent>
</queries>
```

---

### 수정 3: `MoveitWebChromeClient.java` — 오버레이 제거 공개 메서드 + 설정 누락 + try-catch

**변경 A: 오버레이 WebView 설정 보완 (Bug D)**
`onCreateWindow()` 내 오버레이 생성 직후:
```java
overlayWebView.getSettings().setJavaScriptEnabled(true);
overlayWebView.getSettings().setSupportMultipleWindows(true);
overlayWebView.getSettings().setDomStorageEnabled(true);
overlayWebView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true); // ← 추가
```

**변경 B: intent 처리 — `resolveActivity()` → try-catch (Bug B)**
`handleIntentUrlInOverlay()` 수정:
```java
private static boolean handleIntentUrlInOverlay(AppCompatActivity activity, WebView overlay, String url) {
    try {
        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // ← 추가
        try {
            activity.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e1) {
            // 앱 미설치 or Android 11+ resolveActivity 실패 → fallback 시도
        }
        String fallbackUrl = intent.getStringExtra("browser_fallback_url");
        if (fallbackUrl == null) fallbackUrl = intent.getStringExtra("S.browser_fallback_url");
        if (fallbackUrl != null) {
            overlay.loadUrl(fallbackUrl);
            return true;
        }
        if (intent.getPackage() != null) {
            try {
                activity.startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + intent.getPackage())));
                return true;
            } catch (ActivityNotFoundException e2) {
                // 마켓도 없음
            }
        }
    } catch (URISyntaxException e) {
        // invalid intent URI
    } catch (Exception e) {
        // ignore
    }
    return false;
}
```

**변경 C: `removeOverlayFromMainThread()` public 메서드 추가 (Bug C)**
```java
/** MainActivity에서 moveitapp:// 복귀 시 오버레이를 정리하기 위해 외부에서 호출 */
public void removeOverlayFromMainThread() {
    AppCompatActivity activity = (AppCompatActivity) bridge.getContext();
    if (activity == null) return;
    activity.runOnUiThread(this::removeOverlay);
}
```

---

### 수정 4: `MoveitBridgeWebViewClient.java` — `resolveActivity()` → try-catch (Bug B)

`handleIntentUrl()` 수정:
```java
private boolean handleIntentUrl(WebView view, String url) {
    try {
        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // ← 추가
        try {
            view.getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e1) {
            // 앱 미설치 또는 Android 11+ visibility 문제 → fallback
        }
        String fallbackUrl = intent.getStringExtra("browser_fallback_url");
        if (fallbackUrl == null) fallbackUrl = intent.getStringExtra("S.browser_fallback_url");
        if (fallbackUrl != null) {
            view.loadUrl(fallbackUrl);
            return true;
        }
        if (intent.getPackage() != null) {
            try {
                view.getContext().startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + intent.getPackage())));
                return true;
            } catch (ActivityNotFoundException e2) {
                // ignore
            }
        }
    } catch (URISyntaxException e) {
        // not a valid intent uri
    } catch (Exception e) {
        // ignore
    }
    return false;
}
```

커스텀 스킴 처리도 동일하게 `resolveActivity` 제거:
```java
// 기존: if (intent.resolveActivity(getPackageManager()) != null) { startActivity }
// 변경: try { startActivity } catch (ActivityNotFoundException) { ... }
```

---

### 수정 5: `MainActivity.java` — `moveitapp://` 복귀 시 오버레이 제거 (Bug C)

**변경 A: `MoveitWebChromeClient` 인스턴스 필드로 보관**
```java
private MoveitWebChromeClient moveitWebChromeClient;

@Override
protected void load() {
    super.load();
    if (getBridge() == null || getBridge().getWebView() == null) return;
    getBridge().getWebView().getSettings().setSupportMultipleWindows(true);
    moveitWebChromeClient = new MoveitWebChromeClient(getBridge()); // ← 필드에 저장
    getBridge().getWebView().setWebChromeClient(moveitWebChromeClient);
    getBridge().setWebViewClient(new MoveitBridgeWebViewClient(getBridge()));
    handleMoveitAppScheme(getIntent());
}
```

**변경 B: `handleMoveitAppScheme()`에서 오버레이 제거 호출**
```java
private void handleMoveitAppScheme(Intent intent) {
    if (intent == null) return;
    Uri data = intent.getData();
    if (data == null || !"moveitapp".equals(data.getScheme())) return;

    Bridge bridge = getBridge();
    if (bridge == null) return;
    WebView webView = bridge.getWebView();
    if (webView == null) return;

    // moveitapp:// 복귀 시 결제 오버레이가 남아 있으면 제거 ← 추가
    if (moveitWebChromeClient != null) {
        moveitWebChromeClient.removeOverlayFromMainThread();
    }

    String appUrl = bridge.getAppUrl();
    if (appUrl == null || appUrl.isEmpty()) return;

    Uri appUri = Uri.parse(appUrl);
    String base = appUri.getScheme() + "://" + appUri.getHost()
        + (appUri.getPort() > 0 && appUri.getPort() != 443 && appUri.getPort() != 80
            ? ":" + appUri.getPort() : "");
    String path = data.getPath();
    String query = data.getQuery();
    if (path == null || path.isEmpty()) path = "/";
    String fullUrl = base + path + (query != null && !query.isEmpty() ? "?" + query : "");
    webView.loadUrl(fullUrl);
}
```

---

## 4. 수정 후 예상 결제 흐름

### 카드 결제 (ISP/페이북)
```
[정상화된 흐름]
사용자: 카드 선택 → "결제하기"
  → requestPayment({ windowTarget: 'self', card: { appScheme: 'moveitapp://' } })
  → 메인 WebView가 Toss 결제 URL로 이동
  → Toss가 ISP 인증 window.open() 발생
  → MoveitWebChromeClient.onCreateWindow() → 오버레이 WebView 생성
      (setJavaScriptCanOpenWindowsAutomatically: true ← Bug D 수정)
  → 오버레이 WebView: intent://... URL 인터셉트
  → handleIntentUrlInOverlay():
      try { startActivity(intent) } → ISP/페이북 앱 실행 ← Bug B 수정
  → ISP/페이북 앱에서 결제 완료
  → 앱이 moveitapp://payment/ticket/success?paymentKey=...&orderId=...&amount=... 호출
  → MainActivity.onNewIntent()
  → handleMoveitAppScheme():
      moveitWebChromeClient.removeOverlayFromMainThread() ← Bug C 수정 (오버레이 제거)
      webView.loadUrl("https://우리도메인/payment/ticket/success?...")
  → 메인 WebView: 결제 성공 화면 표시
  → /payment/ticket/success → fetchWithAuth('/api/tickets/payment-confirm') → 수강권 발급
  → /my/tickets 이동
```

### 결제 취소
```
[정상화된 흐름]
사용자: 결제창에서 "취소" 또는 뒤로가기
  → Toss SDK throw { code: 'PAY_PROCESS_CANCELED' }
  → handleRequestPayment catch:
      isCancelled = true → onError() 호출 안 함 ← Bug A 수정
      setCancelMsg('결제가 취소되었습니다. 다시 시도해주세요.')
      setPaying(false)
  → 모달이 그대로 열려 있음 (widgetsRef.current 유지)
  → 3초 후 cancelMsg 소거
  → 사용자가 결제 버튼 재클릭 → 동일 주문으로 즉시 재시도 가능
```

---

## 5. 수정이 필요 없는 항목

| 항목 | 이유 |
|------|------|
| `successUrl` / `failUrl` 설정 | `window.location.origin` 기반, 이미 올바름 |
| `card.appScheme: 'moveitapp://'` | AndroidManifest에 선언됨, 올바름 |
| `windowTarget: 'self'` | 토스 공식 가이드 권장(모바일 기본값), 유지 |
| `/payment/ticket/success` 처리 로직 | 멱등성 포함, 이미 올바름 |
| `/payment/ticket/fail` 처리 로직 | 이미 올바름 |
| 카카오페이 | 이미 동작 중, 수정 불필요 |

---

## 6. 구현 순서 (권장)

1. **`ticket-toss-payment-modal.tsx`** — 가장 즉시 체감되는 UX 개선 (취소 후 재시도)
2. **`AndroidManifest.xml`** — 패키지 가시성 선언 (빌드 필요)
3. **`MoveitBridgeWebViewClient.java`** — resolveActivity → try-catch
4. **`MoveitWebChromeClient.java`** — 오버레이 설정 보완 + 공개 메서드 추가
5. **`MainActivity.java`** — moveitapp:// 복귀 시 오버레이 제거 연결

빌드 후 Android 에뮬레이터 또는 실기기에서 카드 결제(ISP/페이북 포함), 카카오페이, 결제 취소 시나리오를 각각 테스트한다.
