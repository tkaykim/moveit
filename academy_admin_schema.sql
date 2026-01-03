-- 학원 관리 시스템을 위한 추가 테이블 스키마
-- 승인 후 실행하세요

-- 1. 상담 관리 (Consultations)
CREATE TABLE public.consultations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  user_id uuid, -- 상담 신청자 (users 테이블 참조, nullable - 전화상담 등)
  name character varying NOT NULL, -- 상담자 이름
  phone character varying, -- 연락처
  topic character varying NOT NULL, -- 상담 주제
  status character varying DEFAULT 'NEW'::character varying CHECK (status::text = ANY (ARRAY['NEW'::character varying, 'SCHEDULED'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying]::text[])),
  scheduled_at timestamp with time zone, -- 상담 예정 시간
  assigned_to uuid, -- 담당자 (users 테이블 참조)
  notes text, -- 상담 메모
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT consultations_pkey PRIMARY KEY (id),
  CONSTRAINT consultations_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT consultations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT consultations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL
);

-- 2. 할인 정책 (Discounts)
CREATE TABLE public.discounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  name character varying NOT NULL, -- 할인 정책 이름
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['PERCENT'::character varying, 'FIXED'::character varying]::text[])), -- PERCENT: 비율, FIXED: 고정 금액
  discount_value integer NOT NULL, -- 할인 값 (비율이면 0-100, 고정이면 원 단위)
  is_active boolean DEFAULT true,
  valid_from date, -- 유효 시작일
  valid_until date, -- 유효 종료일
  description text, -- 설명
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT discounts_pkey PRIMARY KEY (id),
  CONSTRAINT discounts_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE
);

-- 3. 수업 일지 (Daily Logs)
CREATE TABLE public.daily_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  schedule_id uuid NOT NULL, -- 수업 스케줄 참조
  log_date date NOT NULL, -- 일지 작성 날짜
  total_students integer DEFAULT 0, -- 총 학생 수
  present_students integer DEFAULT 0, -- 출석 학생 수
  content text, -- 수업 진도 및 내용
  notes text, -- 특이사항
  status character varying DEFAULT 'PENDING'::character varying CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'COMPLETED'::character varying]::text[])),
  created_by uuid, -- 작성자 (users 테이블 참조)
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT daily_logs_pkey PRIMARY KEY (id),
  CONSTRAINT daily_logs_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT daily_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE,
  CONSTRAINT daily_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT daily_logs_unique_schedule_date UNIQUE (schedule_id, log_date)
);

-- 4. 매출 거래 내역 (Revenue Transactions)
CREATE TABLE public.revenue_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  user_id uuid NOT NULL, -- 구매자
  ticket_id uuid, -- 구매한 수강권 (tickets 테이블 참조)
  user_ticket_id uuid, -- 발급된 수강권 (user_tickets 테이블 참조)
  discount_id uuid, -- 적용된 할인 (discounts 테이블 참조)
  original_price integer NOT NULL DEFAULT 0, -- 원래 가격
  discount_amount integer DEFAULT 0, -- 할인 금액
  final_price integer NOT NULL DEFAULT 0, -- 최종 결제 금액
  payment_method character varying, -- 결제 수단 (CARD, TRANSFER, CASH 등)
  payment_status character varying DEFAULT 'PENDING'::character varying CHECK (payment_status::text = ANY (ARRAY['PENDING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying]::text[])),
  transaction_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  notes text, -- 메모
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT revenue_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT revenue_transactions_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT revenue_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT revenue_transactions_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL,
  CONSTRAINT revenue_transactions_user_ticket_id_fkey FOREIGN KEY (user_ticket_id) REFERENCES public.user_tickets(id) ON DELETE SET NULL,
  CONSTRAINT revenue_transactions_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.discounts(id) ON DELETE SET NULL
);

-- 5. 강사 정산 (Instructor Salaries)
CREATE TABLE public.instructor_salaries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  instructor_id uuid NOT NULL,
  schedule_id uuid, -- 특정 수업 (nullable - 월별 정산의 경우)
  salary_amount integer NOT NULL DEFAULT 0, -- 정산 금액
  salary_type character varying DEFAULT 'PER_CLASS'::character varying CHECK (salary_type::text = ANY (ARRAY['PER_CLASS'::character varying, 'MONTHLY'::character varying, 'PERCENTAGE'::character varying]::text[])), -- 수업당, 월급, 비율
  calculation_period_start date, -- 정산 기간 시작
  calculation_period_end date, -- 정산 기간 종료
  status character varying DEFAULT 'PENDING'::character varying CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'PAID'::character varying]::text[])),
  notes text, -- 메모
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT instructor_salaries_pkey PRIMARY KEY (id),
  CONSTRAINT instructor_salaries_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT instructor_salaries_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(id) ON DELETE CASCADE,
  CONSTRAINT instructor_salaries_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE SET NULL
);

-- 6. 운영 메모 (Operation Notes) - 일지 페이지의 운영 메모용
CREATE TABLE public.operation_notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academy_id uuid NOT NULL,
  note_date date NOT NULL, -- 메모 날짜
  content text NOT NULL, -- 메모 내용
  created_by uuid, -- 작성자
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT operation_notes_pkey PRIMARY KEY (id),
  CONSTRAINT operation_notes_academy_id_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT operation_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT operation_notes_unique_academy_date UNIQUE (academy_id, note_date)
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_consultations_academy_id ON public.consultations(academy_id);
CREATE INDEX idx_consultations_status ON public.consultations(status);
CREATE INDEX idx_discounts_academy_id ON public.discounts(academy_id);
CREATE INDEX idx_discounts_active ON public.discounts(is_active);
CREATE INDEX idx_daily_logs_academy_id ON public.daily_logs(academy_id);
CREATE INDEX idx_daily_logs_schedule_id ON public.daily_logs(schedule_id);
CREATE INDEX idx_daily_logs_log_date ON public.daily_logs(log_date);
CREATE INDEX idx_revenue_transactions_academy_id ON public.revenue_transactions(academy_id);
CREATE INDEX idx_revenue_transactions_user_id ON public.revenue_transactions(user_id);
CREATE INDEX idx_revenue_transactions_transaction_date ON public.revenue_transactions(transaction_date);
CREATE INDEX idx_instructor_salaries_academy_id ON public.instructor_salaries(academy_id);
CREATE INDEX idx_instructor_salaries_instructor_id ON public.instructor_salaries(instructor_id);
CREATE INDEX idx_operation_notes_academy_id ON public.operation_notes(academy_id);
CREATE INDEX idx_operation_notes_note_date ON public.operation_notes(note_date);



