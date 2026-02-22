# Android 에뮬레이터 + MCP로 AI가 화면/상태 확인하기

에뮬레이터(또는 실기기) 화면 스크린샷과 UI 상태를 Cursor AI가 볼 수 있도록 **Mobile MCP**를 쓰면,  
결제 플로우처럼 단계별로 “지금 어떤 화면인지”, “다음 버튼 누른 뒤 외부 브라우저로 나가는지” 등을 함께 점검할 수 있습니다.

---

## 1. 사전 준비

- **Node.js v22+**
- **Android Platform Tools (ADB)**  
  - Android Studio 설치 시 함께 들어 있음.  
  - 경로 예: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`  
  - 터미널에서 `adb version` 실행 가능해야 함.
- **Android 에뮬레이터 또는 USB 연결된 실기기**  
  - 에뮬레이터: Android Studio → Device Manager에서 AVD 생성 후 실행.  
  - 실기기: USB 디버깅 켜고 `adb devices` 로 기기 목록에 보여야 함.

---

## 2. Mobile MCP 설정 (Cursor)

### 방법 A: 프로젝트 설정 사용 (권장)

이 프로젝트에는 이미 **`.cursor/mcp.json`** 에 Mobile MCP가 들어 있습니다.  
Cursor를 **한 번 완전히 종료했다가 다시 실행**한 뒤, 이 프로젝트를 열면 MCP가 로드될 수 있습니다.

### 방법 B: Cursor UI에서 수동 추가

1. **Cursor Settings** → **MCP** (또는 **Tools & MCP**)
2. **Add new MCP Server** 클릭
3. **이름**: `mobile-mcp` (원하는 이름 가능)
4. **Command**:  
   `npx -y @mobilenext/mobile-mcp@latest`  
   (타입이 “Command”인 경우 한 줄 전체 입력)
5. 저장 후 **Cursor 완전 재시작**

### 방법 C: 전역 설정 파일에 추가 (모든 프로젝트에서 사용 시)

Windows 전역 설정 경로:

```
%USERPROFILE%\.cursor\config\mcp.json
```

다음 내용을 `mcpServers` 안에 추가:

```json
"mobile-mcp": {
  "command": "npx",
  "args": ["-y", "@mobilenext/mobile-mcp@latest"]
}
```

저장 후 Cursor 재시작.

---

## 3. 사용 순서

1. **에뮬레이터(또는 실기기) 실행**  
   - 에뮬레이터: AVD 실행 후 부팅 완료될 때까지 대기.  
   - 실기기: USB 연결 후 `adb devices` 에 나오는지 확인.

2. **MOVEIT 앱 설치**  
   - 빌드·설치는 [android_build 규칙](.cursor/rules/android_build.mdc) 참고.  
   - 에뮬레이터/실기기 한 대만 연결된 상태에서 `adb install -r ...` 로 설치.

3. **Cursor에서 AI에게 요청**  
   예시:
   - “연결된 Android 기기 목록 보여줘”
   - “지금 화면 스크린샷 찍어서 보여줘”
   - “MOVEIT 앱 열고 세션 예약 페이지까지 가서 스크린샷 찍어줘”
   - “결제 버튼 누른 다음, 금액 확인 화면에서 스크린샷 한 번 더 찍어줘. 외부 브라우저로 나가는지 확인해줘”

AI가 **Mobile MCP 도구**를 사용해 `mobile_take_screenshot`, `mobile_list_elements_on_screen`, `mobile_click_on_screen_at_coordinates` 등을 호출하면, 에뮬레이터/기기 화면을 단계별로 확인할 수 있습니다.

---

## 4. Mobile MCP에서 쓸 수 있는 도구 요약

| 도구 | 설명 |
|------|------|
| `mobile_list_available_devices` | 연결된 에뮬레이터/기기 목록 |
| `mobile_take_screenshot` | 현재 화면 스크린샷 (AI가 이미지로 확인 가능) |
| `mobile_save_screenshot` | 스크린샷을 파일로 저장 |
| `mobile_list_elements_on_screen` | 화면 위 UI 요소 목록(좌표·속성) |
| `mobile_click_on_screen_at_coordinates` | 지정 좌표 클릭 |
| `mobile_launch_app` | 패키지명으로 앱 실행 (예: `com.moveit.app`) |
| `mobile_swipe_on_screen` | 스와이프 (위/아래/좌/우) |
| `mobile_type_keys` | 텍스트 입력 |
| `mobile_press_button` | BACK, HOME 등 버튼 입력 |

---

## 5. 문제 해결

- **“기기가 안 보여요”**  
  - `adb devices` 로 기기/에뮬이 목록에 있는지 확인.  
  - 에뮬레이터는 한 개만 켜 두고 사용하는 것이 안정적.
- **“MCP 도구가 안 보여요”**  
  - Cursor를 완전히 종료했다가 다시 실행.  
  - MCP 설정에서 `mobile-mcp` 가 켜져 있는지 확인.
- **Node 버전**  
  - Mobile MCP는 Node v22+ 권장. `node -v` 로 확인.

이렇게 설정해 두면, 결제 시 “금액 확인 → 다음” 단계에서 외부 브라우저로 나가는지 등을 **스크린샷과 상태**를 기준으로 함께 점검할 수 있습니다.
