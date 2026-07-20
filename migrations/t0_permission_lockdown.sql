-- T0 — 핵심 권한 잠금 (security lockdown)
-- moveit / Supabase project vjxnollfggbufpqldxrb
--
-- 목적
--  1) user_tickets: 학생이 스스로 수강권 행을 INSERT 하지 못하게 한다.
--     (발급은 결제확인 RPC / 멤버십 부여 RPC / 관리자·서버 API 로만)
--  2) bookings: 학생이 자기 예약 행을 임의 상태로 직접 UPDATE 하지 못하게 한다.
--     학생 취소는 서버 API(/api/bookings/[id]/status, service role) 또는
--     본 마이그레이션이 추가하는 cancel_my_booking() RPC 로만 가능.
--     출결(COMPLETED/ABSENT)·확정(CONFIRMED)은 학원 스태프 전용.
--  3) classes / schedules: 공개 SELECT 를 audience 조건부로 바꾼다.
--     audience_membership_id IS NULL 이면 공개, NOT NULL 이면 학원 스태프 전용.
--     (학생 멤버십 기반 접근은 student_memberships 생성 이후 정책 교체로 확장)
--  4) consume_ticket_count / restore_ticket_count: public/anon/authenticated 에서
--     EXECUTE 회수. 서버(service_role) 전용으로 유지.
--
-- 안전성: 순수 additive + 정책 교체. 데이터 행 삭제/컬럼 변경 없음.
-- audience_membership_id 는 모든 기존 행에서 NULL 이므로 3) 은 현재 데이터에 대해 no-op.

begin;

-- ---------------------------------------------------------------------------
-- 1. classes.audience_membership_id (nullable uuid, FK 는 memberships 생성 후 추가)
-- ---------------------------------------------------------------------------
alter table public.classes
  add column if not exists audience_membership_id uuid;

comment on column public.classes.audience_membership_id is
  'NULL = 공개 수업. NOT NULL = 해당 멤버십 전용(현재는 학원 스태프만 조회 가능). memberships FK 는 후속 태스크에서 추가.';

create index if not exists idx_classes_audience_membership_id
  on public.classes (audience_membership_id)
  where audience_membership_id is not null;

-- ---------------------------------------------------------------------------
-- 2. user_tickets: 학생 self-INSERT 제거
-- ---------------------------------------------------------------------------
-- 기존: ut_insert / INSERT / authenticated
--   WITH CHECK (user_id = auth.uid() OR is_super_admin()
--               OR is_academy_staff((select t.academy_id from tickets t where t.id = ticket_id)))
-- 변경: 학생 self-issue 경로 제거. 스태프/슈퍼관리자만 유지.
drop policy if exists ut_insert on public.user_tickets;

create policy ut_insert_staff on public.user_tickets
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_academy_staff((select t.academy_id from public.tickets t where t.id = user_tickets.ticket_id))
  );

-- ---------------------------------------------------------------------------
-- 3. bookings: 학생 self-UPDATE 제거 (스태프 전용)
-- ---------------------------------------------------------------------------
-- 기존: bookings_update / UPDATE / public
--   USING/WITH CHECK (user_id = auth.uid() OR can_staff_booking(class_id) OR is_super_admin())
-- 변경: user_id = auth.uid() 분기 삭제. 학생 취소는 cancel_my_booking() RPC 로.
drop policy if exists bookings_update on public.bookings;

create policy bookings_update on public.bookings
  for update to public
  using (public.can_staff_booking(class_id) or public.is_super_admin())
  with check (public.can_staff_booking(class_id) or public.is_super_admin());

-- 학생 본인 취소 전용 RPC: 소유권 + 상태 전이 + 취소 마감(수업 시작 전) 검사
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  b public.bookings;
  v_start timestamptz;
begin
  -- 인증 필수
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select * into b from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- 소유권 검사
  if b.user_id is distinct from auth.uid() then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  -- 유효한 상태 전이: CONFIRMED/PENDING -> CANCELLED 만 허용
  -- (COMPLETED/ABSENT/CANCELLED 에서의 전이는 금지)
  if b.status not in ('CONFIRMED', 'PENDING') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation';
  end if;

  -- 취소 마감: 수업 시작 이후에는 학생이 스스로 취소할 수 없다.
  select s.start_time into v_start from public.schedules s where s.id = b.schedule_id;
  if v_start is not null and v_start <= now() then
    raise exception 'CANCELLATION_DEADLINE_PASSED' using errcode = 'check_violation';
  end if;

  update public.bookings
     set status = 'CANCELLED'
   where id = p_booking_id
  returning * into b;

  return b;
end
$function$;

revoke all on function public.cancel_my_booking(uuid) from public, anon;
grant execute on function public.cancel_my_booking(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. classes / schedules: audience 조건부 공개 SELECT
-- ---------------------------------------------------------------------------
-- 기존: classes_select_public / SELECT / {anon,authenticated} USING (true)
drop policy if exists classes_select_public on public.classes;

create policy classes_select_public on public.classes
  for select to anon, authenticated
  using (
    audience_membership_id is null
    -- 멤버십 전용 수업은 학원 스태프/슈퍼관리자만.
    -- 후속 태스크(student_memberships)에서 이 정책을 교체해 학생 조건을 OR 로 추가.
    or public.is_academy_staff(academy_id)
    or public.is_super_admin()
  );

-- 기존: schedules_select_public / SELECT / {anon,authenticated} USING (true)
-- 변경: 부모 class 의 조건을 그대로 따른다.
drop policy if exists schedules_select_public on public.schedules;

create policy schedules_select_public on public.schedules
  for select to anon, authenticated
  using (
    exists (
      select 1
        from public.classes c
       where c.id = schedules.class_id
         and (
           c.audience_membership_id is null
           or public.is_academy_staff(c.academy_id)
           or public.is_super_admin()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. 티켓 카운트 RPC: 클라이언트 EXECUTE 회수 (service_role 전용)
-- ---------------------------------------------------------------------------
-- search_path 를 명시적으로 고정 (기존 'public' -> 'public, pg_temp')
alter function public.consume_ticket_count(uuid, integer) set search_path = public, pg_temp;
alter function public.restore_ticket_count(uuid, integer) set search_path = public, pg_temp;

revoke execute on function public.consume_ticket_count(uuid, integer) from public, anon, authenticated;
revoke execute on function public.restore_ticket_count(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ticket_count(uuid, integer) to service_role;
grant execute on function public.restore_ticket_count(uuid, integer) to service_role;

-- 학원 스태프용 복구 래퍼.
-- 이유: lib/utils/delete-recurring-sessions.ts 는 브라우저(스태프 세션)에서 실행되어
--       service_role 을 쓸 수 없다. 소유 학원 검사를 거치는 래퍼만 authenticated 에 노출한다.
create or replace function public.restore_ticket_count_staff(p_user_ticket_id uuid, p_count integer default 1)
returns public.user_tickets
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_academy_id uuid;
  r public.user_tickets;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  if p_count is null or p_count <= 0 or p_count > 100 then
    raise exception 'INVALID_COUNT' using errcode = 'check_violation';
  end if;

  select t.academy_id into v_academy_id
    from public.user_tickets ut
    join public.tickets t on t.id = ut.ticket_id
   where ut.id = p_user_ticket_id;

  if v_academy_id is null then
    raise exception 'USER_TICKET_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- 명시적 인가 검사: 해당 학원 스태프 또는 슈퍼관리자만
  if not (public.is_academy_staff(v_academy_id) or public.is_super_admin()) then
    raise exception 'NOT_ACADEMY_STAFF' using errcode = 'insufficient_privilege';
  end if;

  update public.user_tickets
     set remaining_count = coalesce(remaining_count, 0) + p_count,
         status = case
                    when status = 'USED' and (coalesce(remaining_count, 0) + p_count) > 0 then 'ACTIVE'
                    else status
                  end
   where id = p_user_ticket_id
     and remaining_count is not null   -- 기간제(null)는 횟수복구 대상 아님
  returning * into r;

  return r;
end
$function$;

revoke all on function public.restore_ticket_count_staff(uuid, integer) from public, anon;
grant execute on function public.restore_ticket_count_staff(uuid, integer) to authenticated, service_role;

commit;
