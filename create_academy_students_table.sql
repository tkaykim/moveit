-- academy_students 테이블 생성
-- 한 학생은 여러 학원의 학생일 수 있도록 many-to-many 관계를 구현

CREATE TABLE IF NOT EXISTS public.academy_students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT academy_students_pkey PRIMARY KEY (id),
  CONSTRAINT academy_students_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT academy_students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT academy_students_unique UNIQUE (academy_id, user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_academy_students_academy_id ON public.academy_students(academy_id);
CREATE INDEX IF NOT EXISTS idx_academy_students_user_id ON public.academy_students(user_id);


