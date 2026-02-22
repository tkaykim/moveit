@echo off
setlocal
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set OUT=%~dp0moveitpay-log.txt

if not exist "%ADB%" (
  echo ADB not found: %ADB%
  exit /b 1
)

echo MoveitPay logcat (stream). Run app, tap "App card", then Ctrl+C.
echo To save buffer to file after, run capture-moveitpay-log-dump.bat
echo.
"%ADB%" logcat -s MoveitPay
endlocal
