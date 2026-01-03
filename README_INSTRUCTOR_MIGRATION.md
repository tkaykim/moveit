# 강사 이름 필드 추가 마이그레이션

## 개요
강사 테이블에 한국어 이름(`name_kr`)과 영어 이름(`name_en`) 필드를 추가합니다.

## 마이그레이션 실행 방법

### Supabase 대시보드에서 실행

1. Supabase 대시보드에 로그인
2. SQL Editor로 이동
3. `migrations/add_instructor_names.sql` 파일의 내용을 복사하여 실행

### 또는 Supabase CLI 사용

```bash
supabase db push
```

## 마이그레이션 내용

- `name_kr` (한국어 이름) 컬럼 추가
- `name_en` (영어 이름) 컬럼 추가
- 기존 `stage_name` 데이터를 `name_kr`로 마이그레이션
- 검색 성능 향상을 위한 인덱스 추가

## 주의사항

- 기존 `stage_name` 필드는 하위 호환성을 위해 유지됩니다
- 한글명 또는 영문명 중 하나는 필수입니다
- 마이그레이션 후 `types/database.ts`를 재생성하는 것을 권장합니다

## 타입 재생성 (선택사항)

Supabase CLI를 사용하여 타입을 재생성할 수 있습니다:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```


