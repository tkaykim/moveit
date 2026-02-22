# 토스페이먼츠 Capacitor 앱 결제 — 구현 점검 및 mobile-mcp 검증

> 참고: [토스페이먼츠 v2 시작하기](https://docs.tosspayments.com/guides/v2/get-started), [카드사·간편결제 자체창 연동](https://docs.tosspayments.com/guides/v2/payment-window/integration-direct), [웹뷰(WebView) 연동 v2](https://docs.tosspayments.com/guides/v2/webview)  
> 기준: `docs/toss-android-payment-fix-plan.md` 및 현재 코드베이스

---

## 1. 적용한 보완 사항 (이번 세션)

### AndroidManifest — 공식 문서 기준 앱 스킴 추가

[웹뷰 v2 앱스킴 리스트](https://docs.tosspayments.com/guides/v2/webview)에 맞춰 `<queries>` 내 `<intent>` 스킴을 보강함.

| 카드사/결제 | 추가된 스킴 |
|-------------|-------------|
| 현대카드 | `smhyundaiansimclick` |
| 신한카드 | `smshinhanansimclick` |
| 롯데카드 | `lottesmartpay` (기존 `lotteappcard` 유지) |
| 하나카드 | `cloudpay`, `hanawalletmembers` (기존 `hanamopmoasign` 유지) |
| 우리카드 | `com.wooricard.wcard`, `newsmartpib` (기존 `wooricard` → 공식 스킴으로 정리) |
| 네이버페이 | `naversearchthirdlogin` (기존 `naversearchapp` 유지) |

이후 특정 카드사/간편결제에서만 “앱으로 안 넘어가거나, 넘어가도 결제 정보 없음”이 있으면, 위 스킴으로 intent가 정상 처리되는지 실기기에서 추가 확인하면 됨.

---

## 2. `toss-android-payment-fix-plan.md` 대비 구현 여부

| 버그 | 계획 | 구현 상태 |
|------|------|-----------|
| **Bug A** 결제 취소 시 세션 유지 | 취소 시 `onError()` 호출 금지, 모달 유지 + 인라인 안내 | ✅ `ticket-toss-payment-modal.tsx`에 `PAY_PROCESS_CANCELED`/`PAY_PROCESS_ABORTED` 구분, `cancelMsg` 표시 |
| **Bug B** Android 11+ intent 가시성 | `<queries>` intent 스킴 + try-catch | ✅ AndroidManifest intent 보강 완료, Bridge/Chrome 클라이언트 try-catch 적용 |
| **Bug C** moveitapp 복귀 시 오버레이 제거 | MainActivity에서 오버레이 제거 후 URL 로드 | ✅ `removeOverlayFromMainThread()` 호출 후 `webView.loadUrl(fullUrl)` |
| **Bug D** 오버레이 WebView 설정 | `setJavaScriptCanOpenWindowsAutomatically(true)` | ✅ `MoveitWebChromeClient` 오버레이에 적용 |

---

## 3. 토스 공식 문서 준수

- **integration-direct:** 모바일 iframe 미사용(`windowTarget: 'self'`), successUrl 쿼리 `amount` 검증(서버 `payment-confirm`), Redirect 방식 사용 → 준수.
- **웹뷰 v2:** intent/커스텀 스킴 `shouldOverrideUrlLoading` 처리, fallback/market 이동, `appScheme: 'moveitapp://'` 및 moveitapp intent-filter → 준수.

---

## 4. mobile-mcp 검증 요약

- **기기:** `192.168.0.5:45935` (SM-S938N, Android 16, 에뮬레이터)
- **진행한 작업**
  1. `mobile_list_available_devices` → 기기 1대 확인
  2. `mobile_launch_app` → `com.moveit.app` 실행
  3. `mobile_take_screenshot` → 홈 화면 확인
  4. `mobile_click_on_screen_at_coordinates` → 하단 “학원” 탭 클릭 → 학원 목록 표시
  5. 학원 카드 클릭 → 세션 예약 화면(“수업 예약”) 진입
  6. “수강권 구매 후 예약” 선택 상태에서 스크롤 → 수강권 선택 + “카드 결제” 선택 화면까지 확인
- **확인된 사항**
  - 앱 기동, 학원 목록, 세션 예약, 수강권 구매·결제 방식 선택 UI까지 정상 노출
  - 결제 위젯이 뜨는 단계(로그인·주문 생성 후 “결제하기” 클릭)는 로그인/세션 전제라 MCP만으로 자동 재현은 제한적
- **실기 권장 시나리오**
  - 로그인 후 동일 경로(학원 → 세션 → 수강권 구매 후 예약 → 카드 결제 → 결제하기)로 진입
  - 결제 취소 → “결제가 취소되었습니다” 안내만 뜨고 모달·세션 유지되는지 확인
  - 카드/ISP 선택 후 해당 앱으로 이동·복귀·결제 완료까지 한 번씩 수동 테스트

---

## 5. 구현 완료도 요약

| 구분 | 상태 |
|------|------|
| 결제 취소 후 세션 유지 (Bug A) | ✅ 구현 완료 |
| Android 11+ intent/스킴 (Bug B) | ✅ 구현 + 공식 스킴 보강 |
| moveitapp 복귀 시 오버레이 제거 (Bug C) | ✅ 구현 완료 |
| 오버레이 JS 창 열기 (Bug D) | ✅ 구현 완료 |
| successUrl/failUrl·amount 검증 | ✅ 기존 구현 유지 |
| 앱 스킴 목록 | ✅ 공식 문서 기준 보강 반영 |
| mobile-mcp 기기·플로우 점검 | ✅ 기기 확인 및 결제 진입 경로까지 검증 |

---

## 6. 다음 권장 단계

1. **실기/에뮬레이터에서 수동 결제 테스트**  
   로그인 후 위 실기 시나리오대로 취소 재시도, 카드/카카오페이/계좌이체 각각 1회씩 진행.
2. **특정 카드사만 실패할 경우**  
   해당 카드사 스킴이 [웹뷰 v2 앱스킴 리스트](https://docs.tosspayments.com/guides/v2/webview)에 있는지 재확인하고, 필요 시 `<queries>`에만 추가해도 됨.
3. **문서 유지**  
   스킴/패키지 추가 시 이 문서와 `toss-android-payment-fix-plan.md`를 함께 갱신.

---

## 7. 결제 디버깅 로그 확인 (현대카드 앱카드 등)

앱에서 **현대카드 앱카드 실행** 버튼을 눌렀을 때 intent/스킴이 우리 WebViewClient에 도달하는지 확인하려면 아래 순서로 로그를 캡처한다.

- **에이전트/원격 터미널**에서는 한글 경로·인코딩 때문에 `adb` 출력이 보이지 않을 수 있음. 그 경우 **로컬** Cursor/VS Code 터미널이나 CMD에서 아래 명령을 직접 실행하거나, `docs/scripts/capture-moveitpay-log-dump.bat`(한 번 덤프 후 종료) / `capture-moveitpay-log.bat`(스트리밍)을 실행해 로그를 확인하면 됨.

### 어디서 하나요? (Android Studio 필수 아님)

- **아무 터미널에서나** 가능합니다.  
  예: **VS Code / Cursor 터미널**, **Windows PowerShell**, **CMD**, **Android Studio 하단 Terminal** 등.
- **필요한 것:**  
  - PC에 **Android SDK platform-tools**가 설치되어 있고,  
  - **adb**가 PATH에 있거나, 아래처럼 **전체 경로**로 실행할 수 있어야 합니다.  
  Android Studio를 설치했다면 보통 다음 경로에 있습니다.  
  - Windows: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`  
  - 예: `C:\Users\본인계정\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- **기기/에뮬레이터:** USB 연결된 실기기 또는 실행 중인 에뮬레이터 한 대가 있어야 합니다. `adb devices`로 연결 여부 확인.

### 어떻게 하나요?

1. **터미널을 연다** (Cursor/VS Code: `` Ctrl+` `` 또는 터미널 메뉴).
2. **로그 수집을 시작한다.**  
   - PATH에 adb가 있으면:
     ```bash
     adb logcat -s MoveitPay
     ```
   - Windows에서 전체 경로로 쓰는 예 (한 줄):
     ```powershell
     & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat -s MoveitPay
     ```
3. **기기/에뮬레이터에서 앱을 연다** → 결제까지 진행 → **현대카드 앱카드 실행** 버튼을 누른다.
4. **터미널에 찍히는 로그**를 확인한다. (`MoveitPay` 태그만 나오므로 결제 관련 로그만 보임.)
5. 끝내려면 터미널에서 **Ctrl+C**로 중단.
6. **파일로 저장**하려면: 프로젝트 루트에서 `docs\scripts\capture-moveitpay-log-dump.bat` 실행 → `docs\scripts\moveitpay-log.txt`에 최근 버퍼가 저장됨. (재현 직후 실행할 것.)

### 절차 요약

1. 연결된 기기/에뮬레이터에서 MOVE.IT 앱 실행
2. 결제 플로우 진입 → 수강권 구매 후 예약 → 카드 결제 선택 → 결제하기
3. 결제 위젯에서 **현대카드** 선택 후 앱카드 실행(또는 해당 카드사 실행) 버튼 클릭
4. 위 명령으로 켜 둔 **로그 창**에서 버튼 클릭 직후 출력되는 로그 확인

### 확인할 로그 패턴

버튼 클릭 시 **다음 중 하나라도** 출력되면, 해당 경로까지 URL이 전달된 것이다.

| 로그 패턴 | 의미 |
|-----------|------|
| `[Chrome] onCreateWindow isUserGesture=...` | `window.open()` 호출됨 (결제창이 새 창으로 열림) |
| `[Bridge] handleUrl: intent://...` | 메인 WebView의 `shouldOverrideUrlLoading`에서 intent 수신 |
| `[Bridge] onPageStarted scheme: ...` | 메인 WebView의 `onPageStarted`에서 intent/스킴 수신 (일부 기기에서만 이 경로로 옴) |
| `[Overlay] handleUrl: intent://...` | 오버레이 WebView에서 intent/스킴 수신 |
| `[Overlay] onPageStarted scheme: ...` | 오버레이의 `onPageStarted`에서 intent/스킴 수신 |

### 해석

- **위 로그가 하나도 안 나온다면**  
  → 우리 WebViewClient/ChromeClient가 호출되지 않는 것. 결제 흐름이 메인/오버레이 WebView가 아닌 다른 경로(예: iframe, 별도 프로세)에서 진행되거나, URL이 아예 발생하지 않는 **구조적 문제** 가능성.
- **`ActivityNotFound` 로그가 나온다면**  
  → URL은 받았지만 해당 앱 실행 실패. **패키지명 불일치** 또는 **해당 카드사 앱 미설치** 또는 Android 11+ `<queries>` 누락 가능성.
- **`intent startActivity OK` / `customScheme startActivity OK` 가 나오는데도 앱이 멈추거나 빈 화면이면**  
  → Intent는 전달됐지만 카드사 앱이 intent를 제대로 처리하지 못하는 케이스. [Intent URL → 앱스킴 URL 변환](https://docs.tosspayments.com/guides/v2/webview) (Flutter/RN ConvertUrl 방식) 적용 검토.
