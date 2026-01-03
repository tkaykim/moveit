-- Schedules를 Classes로 통합하는 마이그레이션
-- 1. Classes에 일정 정보 필드 추가
-- 2. Schedules 데이터를 Classes로 마이그레이션
-- 3. 관련 테이블의 schedule_id를 class_id로 변경
-- 4. Schedules 테이블 제거

-- Step 1: Classes에 일정 정보 필드 추가
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_canceled boolean DEFAULT false;

-- Step 2: Schedules의 데이터를 Classes로 마이그레이션
-- (schedules에 있는 정보로 classes 업데이트)
UPDATE public.classes c
SET 
  start_time = s.start_time,
  end_time = s.end_time,
  instructor_id = COALESCE(s.instructor_id, c.instructor_id),
  hall_id = COALESCE(s.hall_id, c.hall_id),
  max_students = COALESCE(s.max_students, c.max_students),
  current_students = COALESCE(s.current_students, c.current_students),
  is_canceled = s.is_canceled
FROM public.schedules s
WHERE s.class_id = c.id;

-- Step 3: Bookings 테이블의 schedule_id를 class_id로 변경
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS class_id uuid;

-- 기존 schedule_id를 class_id로 마이그레이션
UPDATE public.bookings b
SET class_id = s.class_id
FROM public.schedules s
WHERE b.schedule_id = s.id;

-- Foreign key 제약조건 변경
ALTER TABLE public.bookings 
  DROP CONSTRAINT IF EXISTS bookings_schedule_id_fkey,
  ADD CONSTRAINT bookings_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);

-- schedule_id 컬럼 제거
ALTER TABLE public.bookings DROP COLUMN IF EXISTS schedule_id;

-- Step 4: Daily_logs 테이블의 schedule_id를 class_id로 변경
ALTER TABLE public.daily_logs 
  ADD COLUMN IF NOT EXISTS class_id uuid;

-- 기존 schedule_id를 class_id로 마이그레이션
UPDATE public.daily_logs d
SET class_id = s.class_id
FROM public.schedules s
WHERE d.schedule_id = s.id;

-- Foreign key 제약조건 변경
ALTER TABLE public.daily_logs 
  DROP CONSTRAINT IF EXISTS daily_logs_schedule_id_fkey,
  ADD CONSTRAINT daily_logs_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);

-- schedule_id 컬럼 제거
ALTER TABLE public.daily_logs DROP COLUMN IF EXISTS schedule_id;

-- Step 5: Instructor_salaries 테이블의 schedule_id를 class_id로 변경
ALTER TABLE public.instructor_salaries 
  ADD COLUMN IF NOT EXISTS class_id uuid;

-- 기존 schedule_id를 class_id로 마이그레이션
UPDATE public.instructor_salaries i
SET class_id = s.class_id
FROM public.schedules s
WHERE i.schedule_id = s.id;

-- Foreign key 제약조건 변경
ALTER TABLE public.instructor_salaries 
  DROP CONSTRAINT IF EXISTS instructor_salaries_schedule_id_fkey,
  ADD CONSTRAINT instructor_salaries_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);

-- schedule_id 컬럼 제거
ALTER TABLE public.instructor_salaries DROP COLUMN IF EXISTS schedule_id;

-- Step 6: Schedules 테이블 제거
DROP TABLE IF EXISTS public.schedules CASCADE;

-- Step 7: Classes의 start_time, end_time을 NOT NULL로 변경 (필요시)
-- ALTER TABLE public.classes 
--   ALTER COLUMN start_time SET NOT NULL,
--   ALTER COLUMN end_time SET NOT NULL;



