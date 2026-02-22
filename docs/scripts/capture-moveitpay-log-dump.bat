@echo off
setlocal
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set OUT=%~dp0moveitpay-log.txt

if not exist "%ADB%" (
  echo ADB not found: %ADB%
  exit /b 1
)

echo Dumping last MoveitPay logs to %OUT%
"%ADB%" logcat -d -s MoveitPay > "%OUT%"
echo Done. Open: %OUT%
endlocal
