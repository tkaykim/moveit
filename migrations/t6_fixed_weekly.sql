-- ============================================================================
-- T6 — 고정 주1회(fixed weekly) 자동예약 · 신규 스케줄 백필 · 보강(makeup)
-- ============================================================================
--
-- 배경/규율
--   ① 레거시 자동예약(createBookingsForPeriodTicket)은 is_general PERIOD 수강권에
--      대해 **학원의 모든 regular 수업**을 자동 예약했다. ALL PASS(무제한권)가
--      들어오면 구매자가 30일치 전 수업에 자동 등록된다. → 자동예약은 이제
--      tickets.is_fixed_weekly = true AND user_tickets.fixed_class_id 가 있는
--      경우로만 좁힌다. 그 판정의 물리적 정본이 이 파일의 함수들이다.
--   ② 자동 배치는 **예약 오픈시각을 면제**받는다. 고정 등록자는 일반 오픈 전에
--      이미 자리를 갖는 것이 상품의 정의다. 단 정원은 절대 면제되지 않는다.
--   ③ 자리를 못 잡으면(미생성·정원마감) **스킵하고 횟수는 남긴다**. 실패는
--      주문 확정을 막지 않는다 — 운영자 큐(fixed_weekly_placement_issues)로 간다.
--   ④ 스케줄 INSERT 트리거는 **이벤트만 적는다**. HTTP·무거운 작업 금지.
--      실제 배치는 멱등 프로세서(cron concern)가 한다.
--
-- 보안: 신규 함수는 전부 SET search_path 고정 + PUBLIC/anon/authenticated REVOKE.
--       내부 헬퍼는 아무에게도 EXECUTE 를 주지 않는다(정의자 함수 안에서만 호출).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) booking_events FK 에 ON DELETE CASCADE
--    아래 ④ 트리거가 모든 schedules INSERT 마다 이벤트를 남기므로, cascade 가
--    없으면 스케줄/학원 삭제가 FK 위반으로 막힌다(기존 테스트 정리 경로 포함).
--    제약 교체일 뿐 데이터 삭제가 아니다.
-- ---------------------------------------------------------------------------
alter table public.booking_events
  drop constraint if exists booking_events_schedule_id_fkey;
alter table public.booking_events
  add constraint booking_events_schedule_id_fkey
  foreign key (schedule_id) references public.schedules(id) on delete cascade;

alter table public.booking_events
  drop constraint if exists booking_events_academy_id_fkey;
alter table public.booking_events
  add constraint booking_events_academy_id_fkey
  foreign key (academy_id) references public.academies(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 1) 운영자 큐 — 배치하지 못한 자리
-- ---------------------------------------------------------------------------
create table if not exists public.fixed_weekly_placement_issues (
  id              uuid primary key default gen_random_uuid(),
  academy_id      uuid not null references public.academies(id) on delete cascade,
  user_id         uuid not null,
  user_ticket_id  uuid not null references public.user_tickets(id) on delete cascade,
  class_id        uuid not null references public.classes(id) on delete cascade,
  schedule_id     uuid references public.schedules(id) on delete set null,
  occurrence_date date,
  reason          text not null check (reason in ('SCHEDULE_FULL', 'NO_OCCURRENCE', 'ERROR')),
  shortfall       integer,
  detail          text,
  source          text not null check (source in ('FULFILMENT', 'BACKFILL', 'MAKEUP')),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists fwpi_academy_open_idx
  on public.fixed_weekly_placement_issues (academy_id, resolved_at, created_at desc);
create index if not exists fwpi_user_ticket_idx
  on public.fixed_weekly_placement_issues (user_ticket_id);

alter table public.fixed_weekly_placement_issues enable row level security;

-- 운영자만 읽는다. 쓰기는 service_role(정의자 함수)만 — 정책을 주지 않으면 RLS 로 막힌다.
drop policy if exists fwpi_staff_select on public.fixed_weekly_placement_issues;
create policy fwpi_staff_select on public.fixed_weekly_placement_issues
  for select to authenticated
  using (public.is_academy_staff(academy_id) or public.is_super_admin());

revoke all on public.fixed_weekly_placement_issues from anon;

-- ---------------------------------------------------------------------------
-- 2) 보강(makeup) 사용 원장
--    월 1회 제한을 코드가 아니라 **유니크 인덱스**가 물리적으로 보장한다.
-- ---------------------------------------------------------------------------
create table if not exists public.makeup_grants (
  id               uuid primary key default gen_random_uuid(),
  academy_id       uuid not null references public.academies(id) on delete cascade,
  user_id          uuid not null,
  user_ticket_id   uuid not null references public.user_tickets(id) on delete cascade,
  month_key        date not null,
  from_booking_id  uuid references public.bookings(id) on delete set null,
  to_booking_id    uuid references public.bookings(id) on delete set null,
  from_schedule_id uuid,
  to_schedule_id   uuid,
  created_by       uuid,
  created_at       timestamptz not null default now()
);

create unique index if not exists makeup_grants_ticket_month_uniq
  on public.makeup_grants (user_ticket_id, month_key);
create index if not exists makeup_grants_academy_idx
  on public.makeup_grants (academy_id, created_at desc);

alter table public.makeup_grants enable row level security;

drop policy if exists makeup_grants_staff_select on public.makeup_grants;
create policy makeup_grants_staff_select on public.makeup_grants
  for select to authenticated
  using (public.is_academy_staff(academy_id) or public.is_super_admin());

drop policy if exists makeup_grants_own_select on public.makeup_grants;
create policy makeup_grants_own_select on public.makeup_grants
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.makeup_grants from anon;

-- ---------------------------------------------------------------------------
-- 3) 내부 헬퍼 — 한 자리 배치 (예약창 면제 / 정원 준수)
--    반환: PLACED | DUPLICATE | FULL | NO_COUNT | INELIGIBLE
--    자체 authz 없음. **아무에게도 EXECUTE 를 주지 않는다** — 정의자 함수 내부 전용.
-- ---------------------------------------------------------------------------
create or replace function public.fixed_weekly_place_one_internal(
  p_user_ticket_id uuid,
  p_schedule_id    uuid,
  p_consume        boolean default true
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ut         public.user_tickets;
  v_ticket     public.tickets;
  v_sched      public.schedules;
  v_class_date date;
  v_cap int; v_cur int;
  v_type text;
begin
  select * into v_ut from public.user_tickets where id = p_user_ticket_id for update;
  if not found then return 'INELIGIBLE'; end if;
  if coalesce(v_ut.status, 'ACTIVE') <> 'ACTIVE' then return 'INELIGIBLE'; end if;

  select * into v_ticket from public.tickets where id = v_ut.ticket_id;
  if not found then return 'INELIGIBLE'; end if;

  -- 자동배치 자격의 단일 정본: 고정 주1회 상품 + 고정수업 지정
  if not coalesce(v_ticket.is_fixed_weekly, false) then return 'INELIGIBLE'; end if;
  if v_ut.fixed_class_id is null then return 'INELIGIBLE'; end if;

  select * into v_sched from public.schedules where id = p_schedule_id for update;
  if not found then return 'INELIGIBLE'; end if;
  if coalesce(v_sched.is_canceled, false) then return 'INELIGIBLE'; end if;

  -- 고정 수업 이외에는 절대 배치하지 않는다 (FIXED_CLASS_MISMATCH 와 같은 규칙)
  if v_sched.class_id is distinct from v_ut.fixed_class_id then return 'INELIGIBLE'; end if;

  v_class_date := public.kst_date(v_sched.start_time);
  if v_ut.start_date is not null and v_ut.start_date > v_class_date then return 'INELIGIBLE'; end if;
  if v_ut.expiry_date is not null and v_ut.expiry_date < v_class_date then return 'INELIGIBLE'; end if;

  -- 멱등: 같은 이벤트를 두 번 처리해도 예약은 하나다.
  if exists (
    select 1 from public.bookings b
     where b.schedule_id = p_schedule_id
       and b.user_id = v_ut.user_id
       and b.status in ('CONFIRMED', 'PENDING', 'COMPLETED')
  ) then
    return 'DUPLICATE';
  end if;

  -- 정원은 면제되지 않는다. 마감이면 스킵(예외 아님).
  v_cap := coalesce(v_sched.max_students, 2147483647);
  select count(*) into v_cur from public.bookings b
   where b.schedule_id = p_schedule_id
     and (b.status in ('CONFIRMED', 'COMPLETED')
          or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()));
  if v_cur >= v_cap then return 'FULL'; end if;

  -- ⚠ booking_open_at / booking_close_at 을 **의도적으로 보지 않는다** = 예약창 면제.
  v_type := upper(coalesce(v_ticket.ticket_type, ''));
  if p_consume and v_type = 'COUNT' then
    update public.user_tickets
       set remaining_count = remaining_count - 1,
           status = case when (remaining_count - 1) <= 0 then 'USED' else status end
     where id = v_ut.id and status = 'ACTIVE'
       and remaining_count is not null and remaining_count >= 1;
    if not found then return 'NO_COUNT'; end if;
  end if;

  insert into public.bookings (user_id, class_id, schedule_id, user_ticket_id, status, payment_status)
  values (v_ut.user_id, v_sched.class_id, p_schedule_id, v_ut.id, 'CONFIRMED', 'PAID');

  return 'PLACED';
end $$;

revoke all on function public.fixed_weekly_place_one_internal(uuid, uuid, boolean) from public;
revoke all on function public.fixed_weekly_place_one_internal(uuid, uuid, boolean) from anon;
revoke all on function public.fixed_weekly_place_one_internal(uuid, uuid, boolean) from authenticated;
revoke all on function public.fixed_weekly_place_one_internal(uuid, uuid, boolean) from service_role;

-- ---------------------------------------------------------------------------
-- 4) 발급 직후 배치 — 남은 횟수만큼 앞으로의 고정수업 회차를 잡는다
-- ---------------------------------------------------------------------------
create or replace function public.place_fixed_weekly_bookings(
  p_user_ticket_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ut       public.user_tickets;
  v_ticket   public.tickets;
  v_academy  uuid;
  v_type     text;
  v_limit    int;
  v_placed   int := 0;
  v_full     int := 0;
  v_dup      int := 0;
  v_sched    record;
  v_res      text;
  v_shortfall int;
begin
  select * into v_ut from public.user_tickets where id = p_user_ticket_id;
  if not found then
    raise exception 'USER_TICKET_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select * into v_ticket from public.tickets where id = v_ut.ticket_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select c.academy_id into v_academy from public.classes c where c.id = v_ut.fixed_class_id;
  v_academy := coalesce(v_academy, v_ticket.academy_id);

  if not (public.booking_is_service_role()
          or (v_academy is not null and public.is_academy_staff(v_academy))
          or public.is_super_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  -- ⚠ 회귀 방어선: 고정 주1회가 아니면 **한 건도** 자동 예약하지 않는다.
  --   ALL PASS / 일반 PERIOD 구매가 여기로 와도 결과는 항상 placed = 0 이다.
  if not coalesce(v_ticket.is_fixed_weekly, false) or v_ut.fixed_class_id is null then
    return jsonb_build_object(
      'ok', true, 'eligible', false, 'reason', 'NOT_FIXED_WEEKLY',
      'placed', 0, 'skipped_full', 0, 'skipped_duplicate', 0, 'unspent', 0
    );
  end if;

  v_type := upper(coalesce(v_ticket.ticket_type, ''));
  if v_type = 'COUNT' then
    v_limit := greatest(coalesce(v_ut.remaining_count, 0), 0);
  else
    -- PERIOD 고정권: 유효기간 안의 회차를 전부 잡는다(차감 없음).
    v_limit := 2147483647;
  end if;

  if v_limit = 0 then
    return jsonb_build_object(
      'ok', true, 'eligible', true, 'placed', 0,
      'skipped_full', 0, 'skipped_duplicate', 0, 'unspent', 0
    );
  end if;

  -- 유효기간 안의 앞으로의 회차를 시간순으로. 정원마감이면 다음 회차로 넘어간다.
  for v_sched in
    select s.id, s.start_time
      from public.schedules s
     where s.class_id = v_ut.fixed_class_id
       and coalesce(s.is_canceled, false) = false
       and s.start_time > now()
       and (v_ut.start_date is null or public.kst_date(s.start_time) >= v_ut.start_date)
       and (v_ut.expiry_date is null or public.kst_date(s.start_time) <= v_ut.expiry_date)
     order by s.start_time asc
  loop
    exit when v_placed >= v_limit;

    v_res := public.fixed_weekly_place_one_internal(p_user_ticket_id, v_sched.id, true);

    if v_res = 'PLACED' then
      v_placed := v_placed + 1;
    elsif v_res = 'DUPLICATE' then
      v_dup := v_dup + 1;
    elsif v_res = 'FULL' then
      v_full := v_full + 1;
      insert into public.fixed_weekly_placement_issues (
        academy_id, user_id, user_ticket_id, class_id, schedule_id,
        occurrence_date, reason, source, detail
      ) values (
        v_academy, v_ut.user_id, p_user_ticket_id, v_ut.fixed_class_id, v_sched.id,
        public.kst_date(v_sched.start_time), 'SCHEDULE_FULL', 'FULFILMENT',
        '고정 주1회 자동배치: 정원 마감으로 건너뜀 (횟수는 차감되지 않음)'
      );
    elsif v_res = 'NO_COUNT' then
      exit;
    end if;
  end loop;

  -- 회차 자체가 모자라면(아직 안 만들어짐) 남은 횟수를 운영자에게 보여준다.
  if v_type = 'COUNT' then
    v_shortfall := v_limit - v_placed - v_full;
    if v_shortfall > 0 then
      insert into public.fixed_weekly_placement_issues (
        academy_id, user_id, user_ticket_id, class_id, schedule_id,
        reason, shortfall, source, detail
      ) values (
        v_academy, v_ut.user_id, p_user_ticket_id, v_ut.fixed_class_id, null,
        'NO_OCCURRENCE', v_shortfall, 'FULFILMENT',
        '고정 주1회 자동배치: 배치할 회차가 아직 없음 (횟수는 그대로 남아 있음)'
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'eligible', true,
    'placed', v_placed,
    'skipped_full', v_full,
    'skipped_duplicate', v_dup,
    'unspent', case when v_type = 'COUNT' then greatest(v_limit - v_placed, 0) else 0 end
  );
end $$;

revoke all on function public.place_fixed_weekly_bookings(uuid) from public;
revoke all on function public.place_fixed_weekly_bookings(uuid) from anon;
revoke all on function public.place_fixed_weekly_bookings(uuid) from authenticated;
grant execute on function public.place_fixed_weekly_bookings(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5) 스케줄 INSERT → 이벤트만 기록 (트리거는 절대 무거운 일을 하지 않는다)
-- ---------------------------------------------------------------------------
create or replace function public.trg_schedule_created_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_academy uuid;
begin
  if coalesce(NEW.is_canceled, false) then return NEW; end if;

  select c.academy_id into v_academy from public.classes c where c.id = NEW.class_id;
  if v_academy is null then return NEW; end if;

  insert into public.booking_events (academy_id, event_type, schedule_id, status)
  values (v_academy, 'SCHEDULE_CREATED', NEW.id, 'PENDING');

  return NEW;
end $$;

revoke all on function public.trg_schedule_created_event() from public;
revoke all on function public.trg_schedule_created_event() from anon;
revoke all on function public.trg_schedule_created_event() from authenticated;

drop trigger if exists schedules_created_booking_event on public.schedules;
create trigger schedules_created_booking_event
  after insert on public.schedules
  for each row execute function public.trg_schedule_created_event();

-- ---------------------------------------------------------------------------
-- 6) 백필 프로세서 — PENDING SCHEDULE_CREATED 소비 (멱등)
--    한 이벤트가 실패해도 나머지는 계속 처리된다(서브트랜잭션 격리).
-- ---------------------------------------------------------------------------
create or replace function public.process_schedule_created_events(
  p_limit integer default 200
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ev        record;
  v_sched     public.schedules;
  v_class     public.classes;
  v_class_date date;
  v_ut        record;
  v_res       text;
  v_processed int := 0;
  v_failed    int := 0;
  v_placed    int := 0;
  v_full      int := 0;
  v_err       text;
begin
  if not public.booking_is_service_role() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  for v_ev in
    select id, schedule_id, academy_id, attempts
      from public.booking_events
     where status = 'PENDING' and event_type = 'SCHEDULE_CREATED'
     order by created_at asc
     limit greatest(coalesce(p_limit, 200), 1)
     for update skip locked
  loop
    begin
      select * into v_sched from public.schedules where id = v_ev.schedule_id;

      -- 스케줄이 사라졌거나 취소됐으면 할 일이 없다 → 처리 완료로 닫는다.
      if found and coalesce(v_sched.is_canceled, false) = false and v_sched.start_time > now() then
        select * into v_class from public.classes where id = v_sched.class_id;
        v_class_date := public.kst_date(v_sched.start_time);

        for v_ut in
          select ut.id, ut.user_id
            from public.user_tickets ut
            join public.tickets t on t.id = ut.ticket_id
           where ut.fixed_class_id = v_sched.class_id
             and coalesce(ut.status, 'ACTIVE') = 'ACTIVE'
             and coalesce(t.is_fixed_weekly, false) = true
             and (upper(coalesce(t.ticket_type, '')) = 'PERIOD'
                  or coalesce(ut.remaining_count, 0) > 0)
             and (ut.start_date is null or ut.start_date <= v_class_date)
             and (ut.expiry_date is null or ut.expiry_date >= v_class_date)
           order by ut.created_at asc, ut.id asc
        loop
          v_res := public.fixed_weekly_place_one_internal(v_ut.id, v_sched.id, true);

          if v_res = 'PLACED' then
            v_placed := v_placed + 1;
          elsif v_res = 'FULL' then
            v_full := v_full + 1;
            insert into public.fixed_weekly_placement_issues (
              academy_id, user_id, user_ticket_id, class_id, schedule_id,
              occurrence_date, reason, source, detail
            ) values (
              v_class.academy_id, v_ut.user_id, v_ut.id, v_sched.class_id, v_sched.id,
              v_class_date, 'SCHEDULE_FULL', 'BACKFILL',
              '신규 회차 백필: 정원 마감으로 건너뜀 (횟수는 차감되지 않음)'
            );
          end if;
        end loop;
      end if;

      update public.booking_events
         set status = 'PROCESSED', processed_at = now(),
             attempts = attempts + 1, last_error = null
       where id = v_ev.id;
      v_processed := v_processed + 1;

    exception when others then
      -- 서브트랜잭션만 롤백된다. 아래 기록은 살아남고, 다음 이벤트는 계속 처리된다.
      v_err := sqlerrm;
      update public.booking_events
         set status = 'FAILED', attempts = attempts + 1,
             last_error = left(v_err, 2000), processed_at = now()
       where id = v_ev.id;
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'ok', true, 'processed', v_processed, 'failed', v_failed,
    'placed', v_placed, 'skipped_full', v_full
  );
end $$;

revoke all on function public.process_schedule_created_events(integer) from public;
revoke all on function public.process_schedule_created_events(integer) from anon;
revoke all on function public.process_schedule_created_events(integer) from authenticated;
grant execute on function public.process_schedule_created_events(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 7) 보강(makeup) — 스태프가 실행. 결석 회차를 같은 고정수업의 다른 날짜로 옮긴다.
--    월 상품: 캘린더 월 1회. 3개월 상품(valid_months >= 2): 불가.
--    정원 준수 / 예약창 면제. 횟수는 이동이므로 순증감 없음.
-- ---------------------------------------------------------------------------
create or replace function public.create_makeup_booking(
  p_booking_id         uuid,
  p_target_schedule_id uuid,
  p_actor              uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bk        public.bookings;
  v_ut        public.user_tickets;
  v_ticket    public.tickets;
  v_from_s    public.schedules;
  v_to_s      public.schedules;
  v_academy   uuid;
  v_month     date;
  v_cap int; v_cur int;
  v_new_id    uuid;
  v_grant_id  uuid;
begin
  select * into v_bk from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_bk.user_ticket_id is null then
    raise exception 'MAKEUP_NO_TICKET' using errcode = 'check_violation';
  end if;

  select * into v_from_s from public.schedules where id = v_bk.schedule_id;
  if not found then
    raise exception 'SCHEDULE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select c.academy_id into v_academy from public.classes c where c.id = v_from_s.class_id;

  if not (public.booking_is_service_role()
          or (v_academy is not null and public.is_academy_staff(v_academy))
          or public.is_super_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ut from public.user_tickets where id = v_bk.user_ticket_id for update;
  if not found then
    raise exception 'USER_TICKET_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  select * into v_ticket from public.tickets where id = v_ut.ticket_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not coalesce(v_ticket.is_fixed_weekly, false) or v_ut.fixed_class_id is null then
    raise exception 'MAKEUP_NOT_FIXED_WEEKLY' using errcode = 'check_violation';
  end if;

  -- 3개월(다개월) 상품은 보강 없음 — 상품 정의.
  if coalesce(v_ticket.valid_months, 1) > 1 then
    raise exception 'MAKEUP_NOT_ALLOWED_FOR_TERM' using errcode = 'check_violation';
  end if;

  select * into v_to_s from public.schedules where id = p_target_schedule_id for update;
  if not found then
    raise exception 'SCHEDULE_NOT_FOUND:target' using errcode = 'no_data_found';
  end if;
  if coalesce(v_to_s.is_canceled, false) then
    raise exception 'SCHEDULE_CANCELED:target' using errcode = 'check_violation';
  end if;
  if v_to_s.id = v_from_s.id then
    raise exception 'MAKEUP_SAME_SCHEDULE' using errcode = 'check_violation';
  end if;
  -- 고정수업 티켓은 다른 수업에 쓸 수 없다 (보강도 예외가 아니다).
  if v_to_s.class_id is distinct from v_ut.fixed_class_id then
    raise exception 'FIXED_CLASS_MISMATCH' using errcode = 'check_violation';
  end if;

  -- 월 1회: 결석 회차가 속한 캘린더 월(KST) 기준. 유니크 인덱스가 정본.
  v_month := date_trunc('month', public.kst_date(v_from_s.start_time))::date;

  insert into public.makeup_grants (
    academy_id, user_id, user_ticket_id, month_key,
    from_booking_id, from_schedule_id, to_schedule_id, created_by
  ) values (
    v_academy, v_ut.user_id, v_ut.id, v_month,
    p_booking_id, v_from_s.id, v_to_s.id, p_actor
  )
  on conflict (user_ticket_id, month_key) do nothing
  returning id into v_grant_id;

  if v_grant_id is null then
    raise exception 'MAKEUP_ALREADY_USED:%', to_char(v_month, 'YYYY-MM')
      using errcode = 'unique_violation';
  end if;

  -- 정원은 보강에서도 면제되지 않는다. (예약창은 면제)
  v_cap := coalesce(v_to_s.max_students, 2147483647);
  select count(*) into v_cur from public.bookings b
   where b.schedule_id = v_to_s.id
     and (b.status in ('CONFIRMED', 'COMPLETED')
          or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()));
  if v_cur >= v_cap then
    raise exception 'SCHEDULE_FULL:%', v_to_s.id using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.bookings b
     where b.schedule_id = v_to_s.id and b.user_id = v_ut.user_id
       and b.status in ('CONFIRMED', 'PENDING', 'COMPLETED')
  ) then
    raise exception 'DUPLICATE_BOOKING:%', v_to_s.id using errcode = 'unique_violation';
  end if;

  -- 이동이다: 결석 자리를 반납하고 새 자리를 잡는다. 횟수는 이미 차감돼 있으므로 그대로.
  update public.bookings set status = 'CANCELLED' where id = p_booking_id;

  insert into public.bookings (user_id, class_id, schedule_id, user_ticket_id, status, payment_status)
  values (v_ut.user_id, v_to_s.class_id, v_to_s.id, v_ut.id, 'CONFIRMED', 'PAID')
  returning id into v_new_id;

  update public.makeup_grants set to_booking_id = v_new_id where id = v_grant_id;

  return jsonb_build_object(
    'ok', true, 'makeup_grant_id', v_grant_id, 'month_key', v_month,
    'from_booking_id', p_booking_id, 'booking_id', v_new_id,
    'schedule_id', v_to_s.id
  );
end $$;

revoke all on function public.create_makeup_booking(uuid, uuid, uuid) from public;
revoke all on function public.create_makeup_booking(uuid, uuid, uuid) from anon;
revoke all on function public.create_makeup_booking(uuid, uuid, uuid) from authenticated;
grant execute on function public.create_makeup_booking(uuid, uuid, uuid) to service_role;
