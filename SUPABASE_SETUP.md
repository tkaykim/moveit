# Supabase 설정 가이드

## 문제 해결: 데이터를 불러오지 못하는 경우

### 1. 환경 변수 확인

`.env.local` 파일이 프로젝트 루트에 있고 다음 변수가 설정되어 있는지 확인하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**중요**: 
- 변수명은 반드시 `NEXT_PUBLIC_`로 시작해야 합니다
- 개발 서버를 재시작해야 환경 변수 변경이 적용됩니다

### 2. RLS (Row Level Security) 정책 확인

Supabase는 기본적으로 RLS가 활성화되어 있습니다. 데이터를 읽으려면 정책이 필요합니다.

#### Supabase Dashboard에서 확인:

1. **Authentication** → **Policies** 메뉴로 이동
2. `academies` 테이블의 정책 확인
3. 정책이 없으면 다음 SQL을 실행하세요:

```sql
-- academies 테이블에 대한 읽기 정책 (모든 사용자)
CREATE POLICY "Allow public read access" ON public.academies
FOR SELECT
USING (true);

-- academies 테이블에 대한 쓰기 정책 (모든 사용자)
CREATE POLICY "Allow public insert access" ON public.academies
FOR INSERT
WITH CHECK (true);

-- academies 테이블에 대한 수정 정책 (모든 사용자)
CREATE POLICY "Allow public update access" ON public.academies
FOR UPDATE
USING (true);

-- academies 테이블에 대한 삭제 정책 (모든 사용자)
CREATE POLICY "Allow public delete access" ON public.academies
FOR DELETE
USING (true);
```

또는 개발 단계에서는 RLS를 비활성화할 수 있습니다 (프로덕션에서는 권장하지 않음):

```sql
ALTER TABLE public.academies DISABLE ROW LEVEL SECURITY;
```

### 3. 디버그 페이지 사용

관리자 페이지 사이드바의 "DB 디버그" 메뉴를 사용하여 연결 상태를 확인할 수 있습니다.

### 4. 브라우저 콘솔 확인

브라우저 개발자 도구(F12)의 콘솔 탭에서 다음을 확인하세요:
- 환경 변수 로드 여부
- Supabase 클라이언트 생성 성공 여부
- 쿼리 에러 메시지

### 5. 일반적인 문제

#### 문제: "Missing Supabase environment variables"
- **해결**: `.env.local` 파일 확인 및 개발 서버 재시작

#### 문제: "permission denied for table academies"
- **해결**: RLS 정책 추가 또는 비활성화

#### 문제: "relation does not exist"
- **해결**: 테이블 이름 확인 (대소문자 구분)

#### 문제: 데이터가 있지만 목록이 비어있음
- **해결**: RLS 정책 확인, 콘솔에서 에러 메시지 확인

### 6. 모든 테이블에 대한 RLS 정책 (개발용)

개발 단계에서 모든 테이블에 공개 접근을 허용하려면:

```sql
-- academies
ALTER TABLE public.academies DISABLE ROW LEVEL SECURITY;

-- branches
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;

-- halls
ALTER TABLE public.halls DISABLE ROW LEVEL SECURITY;

-- instructors
ALTER TABLE public.instructors DISABLE ROW LEVEL SECURITY;

-- classes
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;

-- schedules
ALTER TABLE public.schedules DISABLE ROW LEVEL SECURITY;

-- bookings
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
```

**주의**: 프로덕션 환경에서는 적절한 RLS 정책을 설정해야 합니다.




