# 역할(Role) 시스템 설정 가이드

## 역할 종류

시스템에는 다음 5가지 역할이 있습니다:

1. **SUPER_ADMIN (관리자)**
   - 모든 기능에 접근 가능
   - 사용자 권한 부여 가능
   - 전체 시스템 관리

2. **ACADEMY_OWNER (학원 관리자)**
   - 학원 관련 모든 기능 관리
   - 학원, 지점, 홀, 클래스, 시간표 관리
   - 예약 관리

3. **ACADEMY_MANAGER (학원 매니저)**
   - 학원 관련 기능 관리 (소유자와 유사하지만 제한적)
   - 학원, 지점, 홀, 클래스, 시간표 관리
   - 예약 관리

4. **INSTRUCTOR (강사)**
   - 강사 프로필 관리
   - 자신의 클래스 정보 확인

5. **USER (일반 사용자)**
   - 기본 사용자 권한
   - 클래스 조회 및 예약

## 설정 방법

### 1. users 테이블에 role 컬럼 추가

Supabase Dashboard > SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- add_user_role_column.sql 파일의 내용 실행
```

또는 `add_user_role_column.sql` 파일의 내용을 복사하여 실행하세요.

### 2. 초기 관리자 계정 설정

첫 번째 관리자 계정을 생성하려면:

```sql
-- 이메일로 관리자 권한 부여
UPDATE public.users 
SET role = 'SUPER_ADMIN' 
WHERE email = 'your-admin@email.com';
```

### 3. 사용자 권한 부여

관리자 계정으로 로그인한 후:

1. `/admin/users` 페이지로 이동
2. 권한을 변경할 사용자 찾기
3. 역할 열에서 편집 버튼 클릭
4. 원하는 역할 선택 후 저장

## 권한별 접근 가능한 페이지

### SUPER_ADMIN
- 모든 `/admin/*` 페이지 접근 가능
- `/admin/users` 페이지 접근 가능 (권한 부여)

### ACADEMY_OWNER / ACADEMY_MANAGER
- `/admin/academies` - 학원 관리
- `/admin/instructors` - 강사 관리
- `/admin/classes` - 클래스 관리
- `/admin/schedules` - 시간표 관리
- `/admin/bookings` - 예약 관리
- `/admin/branches` - 지점 관리
- `/admin/halls` - 홀 관리
- `/admin/users` - 접근 불가

### INSTRUCTOR
- 제한된 관리 기능 (향후 구현)

### USER
- 일반 사용자 기능만 사용 가능
- `/admin/*` 페이지 접근 불가

## API 엔드포인트

### 권한 변경 API

**POST** `/api/admin/users/role`

**요청 본문:**
```json
{
  "userId": "user-uuid",
  "role": "ACADEMY_OWNER"
}
```

**권한:** SUPER_ADMIN만 가능

**응답:**
```json
{
  "message": "역할이 성공적으로 변경되었습니다.",
  "userId": "user-uuid",
  "role": "ACADEMY_OWNER"
}
```

## 보안 주의사항

1. **SUPER_ADMIN 권한은 신중하게 부여하세요**
   - SUPER_ADMIN은 모든 권한을 가집니다
   - 자신의 역할은 변경할 수 없습니다

2. **미들웨어에서 권한 체크**
   - 모든 `/admin/*` 경로는 미들웨어에서 권한을 확인합니다
   - 권한이 없는 사용자는 자동으로 리다이렉트됩니다

3. **API 레벨 권한 체크**
   - 모든 관리자 API는 서버에서 권한을 확인합니다
   - 클라이언트 측 체크만으로는 충분하지 않습니다

## 문제 해결

### role 컬럼이 없다는 에러

1. `add_user_role_column.sql` 파일을 Supabase SQL Editor에서 실행
2. `user_roles_schema.sql` 파일도 함께 실행 (enum 타입 생성)

### 권한 변경이 안 됨

1. 현재 로그인한 사용자가 SUPER_ADMIN인지 확인
2. 브라우저 개발자 도구에서 네트워크 탭 확인
3. 서버 콘솔에서 에러 로그 확인

### 특정 페이지에 접근할 수 없음

1. 현재 사용자의 role 확인
2. `middleware.ts`에서 해당 경로의 권한 체크 로직 확인
3. 필요한 권한이 있는지 확인




