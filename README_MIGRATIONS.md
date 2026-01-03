# 데이터베이스 마이그레이션 가이드

## 클래스 테이블 업데이트

클래스 테이블에 `price`와 `instructor_id` 컬럼을 추가하는 마이그레이션을 실행하세요.

### Supabase에서 실행할 SQL

1. Supabase Dashboard에 로그인
2. SQL Editor로 이동
3. 다음 SQL을 실행:

```sql
-- Add price column to classes table
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS price integer DEFAULT 0;

-- Add instructor_id column to classes table
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS instructor_id uuid;

-- Add foreign key constraint for instructor_id
ALTER TABLE public.classes 
ADD CONSTRAINT classes_instructor_id_fkey 
FOREIGN KEY (instructor_id) 
REFERENCES public.instructors(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_classes_instructor_id ON public.classes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_classes_price ON public.classes(price);
```

또는 `migrations/add_class_price_and_instructor.sql` 파일의 내용을 복사하여 실행하세요.

### 변경 사항

- `classes.price`: 클래스 요금 (integer, 기본값 0)
- `classes.instructor_id`: 강사 ID (uuid, 외래키 - instructors 테이블 참조)

### 주의사항

- 기존 데이터의 경우 `price`는 0으로, `instructor_id`는 NULL로 설정됩니다.
- 필요시 기존 데이터를 업데이트하세요.



