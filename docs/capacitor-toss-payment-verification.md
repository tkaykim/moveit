# Capacitor + 토스페이먼츠 해결방안 검증 보고서

> 보고서(방안 A/B/C, 웹/앱 통합 아키텍처)와 현재 구현을 비교·검증합니다.

---

## 1. 보고서 핵심 요약

| 구분 | 내용 |
|------|------|
| **원인** | `intent://`, `ispmobile://` 등 금융 앱 스킴을 WebView가 처리하지 못해 OS에 위임 → 기본 브라우저(Chrome/Safari)로 새 창 열림 → 결제 흐름 단절 |
| **권장 방안 A** | 결제위젯(페이지 내 렌더) + **네이티브 Intent 인터셉트** + successUrl/failUrl을 **앱 딥링크**로 설정 |
| **핵심 3가지** | ① Intent URL 가로채기 ② successUrl 앱 딥링크 ③ 결제위젯 사용 |

---

## 2. 현재 구현 vs 보고서 대응 상태

### ✅ 적절히 적용된 항목

| 항목 | 구현 내용 | 보고서 대응 |
|------|-----------|-------------|
| **appScheme** | `moveit://` 추가, requestPayment/requestBillingAuth에 적용 | 카드사 앱 인증 후 복귀용으로 필수. **적절히 적용됨** |
| **Android intent-filter** | `moveit://` 스킴 처리 | 앱 딥링크 수신을 위한 기본 설정. **필수이며 적용됨** |
| **Android queries** | ISP/국민/신한/카카오/토스 등 패키지 등록 | Android 11+에서 카드사 앱 호출 전제. **적절히 적용됨** |

### ✅ 추가 구현 완료 (2차 업데이트)

| 항목 | 구현 내용 |
|------|-----------|
| **Intent 인터셉트** | `PaymentAwareWebViewClient` - intent://, ispmobile:// 등 금융 스킴 가로채기 |
| **successUrl 앱 딥링크** | `getPaymentSuccessUrl`/`getPaymentFailUrl` - 앱 시 moveit:// 사용, MainActivity에서 https로 변환 |
| **window.open 오버라이드** | `PaymentWindowOverride` - 결제 URL만 @capacitor/browser로 앱 내 열기 |

### ❌ 미적용: 결제위젯

**보고서 권장:** 페이지 내 div에 결제위젯 렌더링 (팝업 없음)

**현재:** `requestPayment()` + `@capacitor/browser`로 결제창을 **앱 내 브라우저 모달**에서 열도록 처리.  
→ 외부 브라우저 이탈은 방지되며, UX는 Custom Tabs/SFSafariViewController 형태의 모달로 제공됨.

---

## 3. 정리: 현재 방안의 적절성

| 판단 항목 | 결론 |
|-----------|------|
| **appScheme 추가** | ✅ 적용 |
| **Intent 인터셉트** | ✅ 적용 (`PaymentAwareWebViewClient`) |
| **successUrl 앱 딥링크** | ✅ 적용 (`getPaymentSuccessUrl`, MainActivity) |
| **window.open → 앱 내 브라우저** | ✅ 적용 (`PaymentWindowOverride`, @capacitor/browser) |
| **결제위젯 도입** | ❌ 미적용 (requestPayment + Browser 모달로 대체) |
| **전체 대응 여부** | ✅ **보고서 핵심 요구 대부분 충족** – 결제위젯만 미적용, 네이티브 모달 UX는 Browser로 구현 |

---

## 4. 결론

| 항목 | 평가 |
|------|------|
| **완벽 대응 여부** | ✅ Intent 인터셉트, successUrl 딥링크, window.open 앱 내 처리 구현 완료 |
| **방안 적절성** | ✅ 웹/앱 모두 동일 결제 플로우, 앱에서는 외부 브라우저 이탈 없이 네이티브 모달 형태로 결제 진행 |
| **선택적 개선** | 결제위젯 전환 시 페이지 내 div 렌더링으로 더 단일화된 UX 확보 가능 (중장기) |
