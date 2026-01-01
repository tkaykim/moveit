# 학원 테이블 마이그레이션 가이드

## 변경 사항

학원 테이블에 다음 컬럼이 추가됩니다:
- `name_kr`: 학원명 (한글)
- `name_en`: 학원명 (영문)
- `tags`: 검색 태그 (쉼표로 구분된 문자열)

## Supabase에서 실행할 SQL

1. Supabase Dashboard에 로그인
2. SQL Editor로 이동
3. 다음 SQL을 실행:

```sql
-- Add Korean name column
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS name_kr character varying;

-- Add English name column
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS name_en character varying;

-- Add tags column
ALTER TABLE public.academies 
ADD COLUMN IF NOT EXISTS tags text;

-- Migrate existing name data to name_kr
UPDATE public.academies 
SET name_kr = name 
WHERE name_kr IS NULL AND name IS NOT NULL;

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_academies_name_kr ON public.academies(name_kr);
CREATE INDEX IF NOT EXISTS idx_academies_name_en ON public.academies(name_en);
CREATE INDEX IF NOT EXISTS idx_academies_tags ON public.academies USING gin(to_tsvector('english', tags));
```

또는 `migrations/add_academy_names_and_tags.sql` 파일의 내용을 복사하여 실행하세요.

## 기능

### 학원명 입력
- 한글명과 영문명을 각각 입력할 수 있습니다
- 한글명 또는 영문명 중 하나는 필수입니다
- 둘 다 입력하면 "한글명 (영문명)" 형태로 표시됩니다

### 검색 태그
- 여러 태그를 추가할 수 있습니다
- 태그는 쉼표로 구분되어 저장됩니다
- 검색 기능에서 활용할 수 있습니다

## 주의사항

- 기존 데이터의 `name` 필드는 `name_kr`로 자동 마이그레이션됩니다
- `name` 필드는 하위 호환성을 위해 유지되지만, 새로운 데이터는 `name_kr`과 `name_en`을 사용합니다

