# 업로드 키스토어 비밀번호를 잊었을 때: 새 키스토어 생성
# 실행: PowerShell에서 android 폴더로 이동 후 .\create-upload-keystore.ps1
# 한글 경로 대응: $env:USERPROFILE 사용

$ErrorActionPreference = "Stop"
$androidPath = Join-Path $env:USERPROFILE "Desktop\MOVEIT\android"
$keystorePath = Join-Path $androidPath "app\upload.keystore"
$keytool = "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe"

if (-not (Test-Path $keytool)) {
    Write-Host "Android Studio JBR not found: $keytool" -ForegroundColor Red
    exit 1
}

Set-Location $androidPath

$newKeystoreRelative = "app\upload.keystore"
if (Test-Path $keystorePath) {
    $backup = Join-Path $androidPath "app\upload.keystore.old"
    try {
        Write-Host "Backing up: upload.keystore -> upload.keystore.old"
        Move-Item -Path $keystorePath -Destination $backup -Force
    } catch {
        Write-Host "File in use. Creating new keystore as upload-new.keystore" -ForegroundColor Yellow
        $newKeystoreRelative = "app\upload-new.keystore"
    }
}

Write-Host ""
Write-Host "Create upload keystore. Enter password (twice):" -ForegroundColor Yellow
Write-Host ""

$pass1 = Read-Host "Keystore password" -AsSecureString
$pass2 = Read-Host "Confirm password" -AsSecureString
$bstr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass1)
$bstr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass2)
$plain1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
$plain2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)

if ($plain1 -ne $plain2) {
    Write-Host "Passwords do not match." -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrWhiteSpace($plain1)) {
    Write-Host "Password cannot be empty." -ForegroundColor Red
    exit 1
}

# -dname 으로 질문 생략, '맞습니까?' 확인 단계 없이 한 번에 생성
$dname = "CN=MoveIt, OU=Android, O=MoveIt, L=Seoul, ST=Seoul, C=KR"
& $keytool -genkey -v -keystore $newKeystoreRelative -alias "upload" -keyalg RSA -keysize 2048 -validity 10000 -storepass $plain1 -keypass $plain1 -dname $dname

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done. Next:" -ForegroundColor Green
    Write-Host "1. Copy key.properties.example to key.properties"
    $storeFileHint = if ($newKeystoreRelative -eq "app\upload-new.keystore") { " Set storeFile=app/upload-new.keystore" } else { "" }
    Write-Host "2. Edit key.properties: add your password, keyAlias=upload$storeFileHint"
    Write-Host "3. If app already on Play: Console > App signing > Request upload key reset"
}
