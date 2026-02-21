# Android APK 빌드 및 무선 기기 설치

Cursor 터미널에서는 한글 사용자 경로(`C:\Users\그리고\...`) 인코딩 문제로 Gradle/ADB 명령이 실패할 수 있습니다.  
**Windows 명령 프롬프트(cmd) 또는 PowerShell을 직접 열어** 아래 순서대로 실행하세요.

---

## 1. 사전 확인

- **Java(JDK)**: 설치되어 있고 `JAVA_HOME` 환경 변수 설정
- **Android SDK**: 설치되어 있고 `android/local.properties`에 `sdk.dir` 설정

---

## 2. 무선 디버깅 연결 (선택)

실기기에 설치하려면 기기에서 **개발자 옵션 → 무선 디버깅**을 켜고,  
**IP:포트**와 **페어링 코드**를 확인한 뒤:

```cmd
adb pair 192.168.0.5:34175
```
(프롬프트에 나오는 곳에 페어링 코드 입력, 예: 342165)

```cmd
adb connect 192.168.0.5:40303
```

연결 확인:

```cmd
adb devices -l
```

`192.168.0.5:40303`가 **device**로 나와야 합니다. **offline**이면 기기에서 무선 디버깅 허용을 다시 확인하세요.

---

## 3. APK 빌드

프로젝트 루트가 `C:\Users\그리고\Desktop\MOVEIT` 일 때:

```cmd
cd C:\Users\그리고\Desktop\MOVEIT\android
gradlew.bat assembleDebug
```

또는 배치 파일 실행:

```cmd
C:\Users\그리고\Desktop\MOVEIT\android\build_apk.bat
```

빌드 성공 시 APK 경로:

```
C:\Users\그리고\Desktop\MOVEIT\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 4. 기기에 설치

연결된 기기 한 대일 때:

```cmd
adb install -r C:\Users\그리고\Desktop\MOVEIT\android\app\build\outputs\apk\debug\app-debug.apk
```

여러 기기일 때는 `-s` 로 지정:

```cmd
adb -s 192.168.0.5:40303 install -r C:\Users\그리고\Desktop\MOVEIT\android\app\build\outputs\apk\debug\app-debug.apk
```

`-r`: 기존에 설치된 앱이 있으면 덮어쓰기(재설치).

---

## 5. ADB 경로가 없을 때

ADB가 PATH에 없으면 전체 경로로 실행:

```cmd
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r ...\app-debug.apk
```

---

## 요약

| 단계 | 명령 |
|------|------|
| 페어링 | `adb pair 192.168.0.5:34175` → 코드 입력 |
| 연결 | `adb connect 192.168.0.5:40303` |
| 빌드 | `cd ...\MOVEIT\android` 후 `gradlew.bat assembleDebug` |
| 설치 | `adb install -r ...\app-debug.apk` |
