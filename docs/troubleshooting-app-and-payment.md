# 앱 로드 실패 / 결제 오류 대응

Push 이후 **Android 앱이 아예 로드되지 않거나**, **웹에서 결제 시 "결제위젯 연동 키의 클라이언트 키로 SDK를 연동해주세요"** 오류가 날 때 확인할 사항입니다.

---

## 1. 웹 결제 오류: "API 개별 연동 키는 지원하지 않습니다"

### 원인

- 이 프로젝트의 **세션 예약 결제**는 토스 **결제위젯 SDK**를 사용합니다.
- 토스페이먼츠는 **결제위젯 연동 키**(`gck`/`gsk`)와 **API 개별 연동 키**(`ck`/`sk`)를 구분합니다.
- 결제위젯에는 **반드시 결제위젯 연동 키**를 써야 하며, **API 개별 연동 키를 쓰면 위 오류**가 납니다.

### 해결

1. **[토스페이먼츠 개발자센터 → API 키](https://developers.tosspayments.com/my/api-keys)** 에서  
   **결제위젯 연동 키**를 확인하세요. (클라이언트 키에 `gck`, 시크릿 키에 `gsk` 포함.)
2. **Vercel** (및 로컬 `.env.local`)에서:
   - `NEXT_PUBLIC_TOSS_CLIENT_KEY` = 결제위젯용 **클라이언트 키**(`test_gck_...` 또는 `live_gck_...`)
   - `TOSS_SECRET_KEY` = 같은 세트의 결제위젯용 **시크릿 키**(`test_gsk_...` 또는 `live_gsk_...`)
3. **Redeploy** 후 다시 결제 시도.

자세한 설명은 **docs/vercel-toss-env.md** 를 참고하세요.

---

## 2. Android 앱이 아예 로드되지 않음

### 원인

- Android 앱은 **Capacitor**로 빌드하며, **내부는 WebView**입니다.
- WebView는 **배포된 웹 URL**(기본값: `https://moveit-xi.vercel.app`)만 로드합니다.  
  즉, **앱 = 해당 URL의 웹 페이지를 감싼 껍데기**입니다.
- 따라서 아래가 되면 앱에서도 **흰 화면·로드 실패**처럼 보입니다.
  - Vercel 빌드 실패 또는 배포 오류
  - 해당 URL에서 **JavaScript 런타임 오류**로 첫 화면이 깨짐
  - 네트워크/SSL 문제로 해당 URL 접근 불가

### 확인 순서

1. **브라우저에서 배포 URL 직접 접속**  
   `https://moveit-xi.vercel.app` (또는 사용 중인 도메인)을 PC/휴대폰 브라우저로 열어보세요.
   - 페이지가 정상적으로 뜨는지
   - 콘솔에 빨간 에러가 없는지 확인합니다.

2. **Vercel 배포 상태**  
   - Vercel 대시보드에서 해당 프로젝트 **Deployments** 확인.
   - 최근 Push에 해당하는 배포가 **성공(Ready)** 인지, 빌드 로그에 에러가 없는지 봅니다.

3. **환경 변수**  
   - Vercel **Settings → Environment Variables** 에서  
     `NEXT_PUBLIC_TOSS_CLIENT_KEY` 등이 **결제위젯 연동 키(gck)** 로 올바르게 설정돼 있는지 확인합니다.  
   - 잘못된 키로 인해 특정 페이지에서 예외가 나면, 그 페이지를 열 때 앱이 깨져 보일 수 있습니다.

4. **앱 쪽 설정**  
   - `capacitor.config.ts`의 `server.url`(또는 `CAPACITOR_SERVER_URL`)이 실제 배포 URL과 일치하는지 확인합니다.  
   - 앱을 다시 빌드한 경우, `npx cap sync` 후 해당 URL이 `android/app/src/main/assets/capacitor.config.json` 등에 반영됐는지 확인합니다.

### 요약

- **앱 로드 실패 = WebView가 로드하는 웹이 깨졌거나 접근 불가**일 가능성이 큽니다.
- 웹 결제 오류(결제위젯 키)를 먼저 **Vercel + 결제위젯 연동 키**로 해결한 뒤,  
  브라우저에서 해당 URL이 정상 동작하는지 확인하면, 앱도 같은 URL을 쓰므로 함께 정상화되는 경우가 많습니다.
