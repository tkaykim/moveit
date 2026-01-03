-- 정기 수업 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  academy_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time NOT NULL, -- 시간만 저장 (예: 14:00:00)
  end_time time NOT NULL, -- 시간만 저장 (예: 15:00:00)
  days_of_week integer[] NOT NULL DEFAULT '{}', -- 요일 배열 [0=일, 1=월, 2=화, ..., 6=토]
  hall_id uuid,
  instructor_id uuid,
  max_students integer DEFAULT 20,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT recurring_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
  CONSTRAINT recurring_schedules_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT recurring_schedules_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON DELETE SET NULL,
  CONSTRAINT recurring_schedules_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE SET NULL,
  CONSTRAINT recurring_schedules_days_check CHECK (array_length(days_of_week, 1) > 0),
  CONSTRAINT recurring_schedules_date_check CHECK (end_date >= start_date)
);

-- schedules 테이블에 recurring_schedule_id 추가 (이미 존재하면 무시)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'schedules' 
    AND column_name = 'recurring_schedule_id'
  ) THEN
    ALTER TABLE public.schedules 
    ADD COLUMN recurring_schedule_id uuid;
    
    ALTER TABLE public.schedules 
    ADD CONSTRAINT schedules_recurring_schedule_id_fkey 
    FOREIGN KEY (recurring_schedule_id) 
    REFERENCES public.recurring_schedules(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_class_id ON public.recurring_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_academy_id ON public.recurring_schedules(academy_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON public.recurring_schedules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedules_recurring_schedule_id ON public.schedules(recurring_schedule_id);

-- 코멘트 추가
COMMENT ON TABLE public.recurring_schedules IS '정기 수업 템플릿. 지정된 기간 동안 매주 반복되는 수업의 설정을 저장합니다.';
COMMENT ON COLUMN public.recurring_schedules.days_of_week IS '수업이 진행되는 요일 배열. 0=일요일, 1=월요일, ..., 6=토요일';
COMMENT ON COLUMN public.recurring_schedules.start_time IS '수업 시작 시간 (시간만, 날짜 없음)';
COMMENT ON COLUMN public.recurring_schedules.end_time IS '수업 종료 시간 (시간만, 날짜 없음)';
COMMENT ON COLUMN public.schedules.recurring_schedule_id IS '이 스케줄이 생성된 정기 수업 템플릿의 ID. NULL이면 일반 수업입니다.';

