# 환경 변수 설정 가이드

## 문제: "Missing Supabase environment variables"

이 에러는 Next.js가 Supabase 환경 변수를 찾지 못할 때 발생합니다.

## 해결 방법

### 1. .env.local 파일 생성

프로젝트 루트 디렉토리(`MOVEIT` 폴더)에 `.env.local` 파일을 생성하세요.

### 2. 환경 변수 추가

`.env.local` 파일에 다음 내용을 추가하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**중요 사항:**
- 변수명은 반드시 `NEXT_PUBLIC_`로 시작해야 합니다
- `=` 앞뒤에 공백이 없어야 합니다
- 따옴표나 쌍따옴표로 감싸지 마세요

### 3. Supabase 키 찾기

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. **Settings** → **API** 메뉴로 이동
4. 다음 정보를 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`에 입력
   - **anon public** 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 입력

### 4. 개발 서버 재시작

환경 변수를 변경한 후에는 **반드시** 개발 서버를 재시작해야 합니다:

```bash
# 터미널에서 Ctrl+C로 서버 중지 후
npm run dev
```

### 5. 파일 위치 확인

`.env.local` 파일이 프로젝트 루트에 있어야 합니다:

```
MOVEIT/
├── .env.local          ← 여기에 있어야 함
├── app/
├── lib/
├── package.json
└── ...
```

### 6. 파일 내용 예시

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMDAwMDAwMCwiZXhwIjoxOTQ1NTc2MDAwfQ.example
```

### 7. 확인 방법

1. 브라우저 개발자 도구(F12) → Console 탭
2. 에러 메시지가 사라졌는지 확인
3. 관리자 페이지 → "DB 디버그" 메뉴에서 연결 상태 확인

### 8. 여전히 작동하지 않는 경우

1. **파일 이름 확인**: `.env.local` (점으로 시작, 확장자 없음)
2. **파일 인코딩**: UTF-8로 저장
3. **캐시 삭제**: `.next` 폴더 삭제 후 재시작
   ```bash
   rm -rf .next
   npm run dev
   ```
4. **환경 변수 확인**: `env.example` 파일을 참고하세요

### 9. Windows에서 파일 생성하기

PowerShell에서:
```powershell
New-Item -Path .env.local -ItemType File
notepad .env.local
```

또는 VS Code에서:
- 새 파일 생성
- 파일명: `.env.local`
- 내용 입력 후 저장

