# name 및 stage_name 필드 제거 마이그레이션

## 개요
`academies` 테이블의 `name` 필드와 `instructors` 테이블의 `stage_name` 필드를 제거하고, `name_kr`과 `name_en`만 사용하도록 변경합니다.

## 마이그레이션 실행 방법

### Supabase 대시보드에서 실행

1. Supabase 대시보드에 로그인
2. SQL Editor로 이동
3. `migrations/remove_name_and_stage_name.sql` 파일의 내용을 복사하여 실행

### 또는 Supabase CLI 사용

```bash
supabase db push
```

## 마이그레이션 내용

- `academies` 테이블에서 `name` 컬럼 제거
- `instructors` 테이블에서 `stage_name` 컬럼 제거

## 주의사항

⚠️ **중요**: 이 마이그레이션을 실행하기 전에 다음을 확인하세요:

1. **데이터 백업**: 마이그레이션 전에 데이터를 백업하세요
2. **기존 데이터**: `name_kr` 또는 `name_en`에 값이 있는지 확인하세요
3. **의존성**: 다른 시스템이나 외부 API에서 `name` 또는 `stage_name` 필드를 사용하는지 확인하세요

## 코드 변경사항

다음 파일들이 업데이트되었습니다:

- `app/admin/academies/page.tsx` - `name` 필드 제거
- `app/admin/instructors/page.tsx` - `stage_name` 필드 제거
- `app/admin/classes/page.tsx` - `academy.name`, `instructor.stage_name` → `name_kr`/`name_en` 사용
- `app/admin/schedules/page.tsx` - `instructor.stage_name` → `name_kr`/`name_en` 사용
- `app/admin/branches/page.tsx` - `academy.name` → `name_kr`/`name_en` 사용

## 표시 형식

- 한글명과 영문명이 모두 있는 경우: `한글명 (영문명)`
- 한글명만 있는 경우: `한글명`
- 영문명만 있는 경우: `영문명`
- 둘 다 없는 경우: `-`

## 타입 재생성 (선택사항)

Supabase CLI를 사용하여 타입을 재생성할 수 있습니다:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```




