-- T2: 예약 정책 / 커버리지 / 차감 / 취소 엔진 (라이브 DB 적용본 스냅샷)
--
-- 적용 순서(실제 마이그레이션):
--   20260719140916 t2_booking_engine_class_group_and_coverage_helpers
--   20260719140947 t2_capacity_counts_live_holds
--   20260719141030 t2_create_booking_tx
--   20260719141051 t2_cancel_booking_tx
--   20260719142013 t2_lock_down_engine_functions  (+ 두 tx 함수 재정의: anon 차단)
--
-- 이 파일은 위 마이그레이션 적용 후의 최종 상태를 재현하는 idempotent 스냅샷이다.
--
-- ⚠ 권위 있는 정본은 `migrations/applied/` 이다 (라이브 schema_migrations 를 그대로 export 한 34개).
--   특히 booking_is_service_role() 은 t3(20260719144018 t3_fix_service_role_detection)에서
--   current_user → session_user 로 수정되었다. 아래 정의는 그 라이브-정합 버전으로 갱신했다
--   (SECURITY DEFINER 안에서 current_user 는 항상 소유자 postgres 가 되어 오너십 가드가 무력화되는 문제).

alter table public.classes
  add column if not exists class_group_id uuid references public.class_groups(id) on delete set null;
create index if not exists idx_classes_class_group_id on public.classes(class_group_id);

CREATE OR REPLACE FUNCTION public.kst_date(p_ts timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select (p_ts at time zone 'Asia/Seoul')::date;
$function$
;

CREATE OR REPLACE FUNCTION public.kst_inclusive_expiry(p_start date, p_valid_days integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_start + (p_valid_days - 1);
$function$
;

CREATE OR REPLACE FUNCTION public.kst_months_expiry(p_start date, p_valid_months integer)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select (p_start + (p_valid_months || ' months')::interval)::date - 1;
$function$
;

CREATE OR REPLACE FUNCTION public.booking_ticket_covers_class(p_ticket_id uuid, p_class_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_class_academy uuid;
  v_group_id uuid;
  v_is_special boolean;
  v_ticket record;
  v_has_class_map boolean;
  v_has_coverage boolean;
begin
  select c.academy_id, c.class_group_id, coalesce(g.is_special, false)
    into v_class_academy, v_group_id, v_is_special
    from public.classes c
    left join public.class_groups g on g.id = c.class_group_id
   where c.id = p_class_id;

  if not found then return false; end if;

  -- 그룹 미지정 수업은 어떤 수강권으로도 예약 불가
  if v_group_id is null then return false; end if;

  select t.academy_id, t.is_general, t.class_id into v_ticket
    from public.tickets t where t.id = p_ticket_id;
  if not found then return false; end if;

  if v_ticket.academy_id is not null and v_ticket.academy_id is distinct from v_class_academy then
    return false;
  end if;

  -- (1) ticket_classes: row 가 하나라도 있으면 이 계층이 결론
  select exists(select 1 from public.ticket_classes tc where tc.ticket_id = p_ticket_id)
    into v_has_class_map;
  if v_has_class_map then
    return exists(
      select 1 from public.ticket_classes tc
       where tc.ticket_id = p_ticket_id and tc.class_id = p_class_id
    );
  end if;

  -- (2) ticket_coverage: 활성 row 가 하나라도 있으면 이 계층이 결론
  select exists(
    select 1 from public.ticket_coverage tv
     where tv.ticket_id = p_ticket_id and tv.is_active
  ) into v_has_coverage;
  if v_has_coverage then
    return exists(
      select 1 from public.ticket_coverage tv
       where tv.ticket_id = p_ticket_id and tv.is_active
         and tv.class_group_id = v_group_id
    );
  end if;

  -- (3) 레거시: 스페셜 그룹은 절대 통과 불가
  if v_is_special then return false; end if;
  if coalesce(v_ticket.is_general, false) then return true; end if;
  if v_ticket.class_id is not null and v_ticket.class_id = p_class_id then return true; end if;
  return false;
end $function$
;

CREATE OR REPLACE FUNCTION public.booking_resolve_policy(p_academy jsonb, p_class jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v jsonb := jsonb_build_object(
    'open', null,
    'close', jsonb_build_object('minutesBefore', 0),
    'cancelUntil', jsonb_build_object('minutesBefore', 0)
  );
  layer jsonb;
begin
  foreach layer in array array[p_academy, p_class] loop
    if layer is null or jsonb_typeof(layer) <> 'object' then continue; end if;
    if layer ? 'open' then v := jsonb_set(v, '{open}', coalesce(layer->'open', 'null'::jsonb)); end if;
    if layer ? 'close' and jsonb_typeof(layer->'close') = 'object' then
      v := jsonb_set(v, '{close}', layer->'close');
    end if;
    if layer ? 'cancelUntil' and jsonb_typeof(layer->'cancelUntil') = 'object' then
      v := jsonb_set(v, '{cancelUntil}', layer->'cancelUntil');
    end if;
  end loop;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.booking_open_at(p_start timestamp with time zone, p_policy jsonb)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  o jsonb := p_policy->'open';
  v_days int;
  v_time text;
begin
  if o is null or jsonb_typeof(o) <> 'object' then return null; end if;
  v_days := coalesce((o->>'daysBefore')::int, 0);
  v_time := coalesce(o->>'time', '00:00');
  return ((public.kst_date(p_start) - v_days)::text || ' ' || v_time)::timestamp
         at time zone 'Asia/Seoul';
end $function$
;

CREATE OR REPLACE FUNCTION public.booking_close_at(p_start timestamp with time zone, p_policy jsonb)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_start - (coalesce((p_policy->'close'->>'minutesBefore')::int, 0) || ' minutes')::interval;
$function$
;

CREATE OR REPLACE FUNCTION public.booking_cancel_deadline_at(p_start timestamp with time zone, p_policy jsonb)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_start - (coalesce((p_policy->'cancelUntil'->>'minutesBefore')::int, 0) || ' minutes')::interval;
$function$
;

CREATE OR REPLACE FUNCTION public.booking_is_service_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
    ''
  ) = 'service_role'
     or (
          session_user in ('postgres', 'supabase_admin')
          and nullif(current_setting('request.jwt.claims', true), '') is null
        );
$function$
;

CREATE OR REPLACE FUNCTION public.trg_enforce_schedule_capacity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cap int; cur int; sched record; new_occupies boolean; old_occupied boolean;
begin
  new_occupies := NEW.status in ('CONFIRMED','COMPLETED')
    or (NEW.status = 'PENDING' and NEW.hold_expires_at is not null and NEW.hold_expires_at > now());

  if not new_occupies then
    return NEW;
  end if;

  -- 관리자 수동추가는 정원 무시
  if coalesce(NEW.is_admin_added, false) then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    old_occupied := OLD.status in ('CONFIRMED','COMPLETED')
      or (OLD.status = 'PENDING' and OLD.hold_expires_at is not null and OLD.hold_expires_at > now());
    -- 이미 점유 중이었고 같은 스케줄이면 새 좌석 소비가 아님
    if old_occupied and NEW.schedule_id = OLD.schedule_id then
      return NEW;
    end if;
  end if;

  if NEW.schedule_id is null then return NEW; end if;

  select * into sched from public.schedules where id = NEW.schedule_id for update;
  if not found then return NEW; end if;

  if TG_OP = 'INSERT' and sched.is_canceled then
    raise exception 'SCHEDULE_CANCELED' using errcode = 'check_violation';
  end if;

  cap := coalesce(sched.max_students, 2147483647);
  select count(*) into cur from public.bookings
    where schedule_id = NEW.schedule_id
      and id <> NEW.id
      and (status in ('CONFIRMED','COMPLETED')
           or (status = 'PENDING' and hold_expires_at is not null and hold_expires_at > now()));
  if cur >= cap then
    raise exception 'SCHEDULE_FULL' using errcode = 'check_violation';
  end if;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_sync_schedule_student_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare target uuid;
begin
  target := coalesce(NEW.schedule_id, OLD.schedule_id);
  if target is not null then
    update public.schedules s set current_students = (
      select count(*) from public.bookings b
      where b.schedule_id = target
        and (b.status in ('CONFIRMED','COMPLETED')
             or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()))
    ) where s.id = target;
  end if;
  if TG_OP = 'UPDATE' and NEW.schedule_id is distinct from OLD.schedule_id and OLD.schedule_id is not null then
    update public.schedules s set current_students = (
      select count(*) from public.bookings b
      where b.schedule_id = OLD.schedule_id
        and (b.status in ('CONFIRMED','COMPLETED')
             or (b.status = 'PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()))
    ) where s.id = OLD.schedule_id;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_booking_tx(p_schedule_id uuid, p_user_ticket_id uuid DEFAULT NULL::uuid, p_order_item_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_is_service boolean := public.booking_is_service_role();
  v_user_id uuid; v_sched record; v_class record; v_group_is_special boolean;
  v_policy jsonb; v_open timestamptz; v_close timestamptz; v_class_date date;
  v_designated uuid; v_ut record; v_ticket record; v_cap int; v_cur int;
  v_booking public.bookings; v_started boolean := false;
  v_new_start date; v_new_expiry date; v_deducted boolean := false;
  v_covered boolean; v_has_explicit boolean;
begin
  v_user_id := coalesce(p_user_id, v_caller);
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;
  if not v_is_service and (v_caller is null or v_user_id is distinct from v_caller) then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  select * into v_sched from public.schedules where id = p_schedule_id for update;
  if not found then raise exception 'SCHEDULE_NOT_FOUND' using errcode = 'no_data_found'; end if;
  if v_sched.is_canceled then raise exception 'SCHEDULE_CANCELED' using errcode = 'check_violation'; end if;

  v_class_date := public.kst_date(v_sched.start_time);

  select c.*, coalesce(g.is_special, false) as grp_special into v_class
    from public.classes c left join public.class_groups g on g.id = c.class_group_id
   where c.id = v_sched.class_id;
  if not found then raise exception 'CLASS_NOT_FOUND' using errcode = 'no_data_found'; end if;
  v_group_is_special := v_class.grp_special;

  if v_class.class_group_id is null then
    raise exception 'CLASS_NOT_BOOKABLE' using errcode = 'check_violation';
  end if;

  if v_class.audience_membership_id is not null then
    if not exists (
      select 1 from public.student_memberships sm
       where sm.user_id = v_user_id and sm.membership_id = v_class.audience_membership_id
         and sm.status = 'ACTIVE' and sm.start_date <= v_class_date
         and (sm.end_date is null or sm.end_date >= v_class_date)
    ) then
      raise exception 'AUDIENCE_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
    end if;
  end if;

  select public.booking_resolve_policy(a.booking_policy, v_class.booking_policy) into v_policy
    from public.academies a where a.id = v_class.academy_id;
  v_policy := coalesce(v_policy, public.booking_resolve_policy(null, v_class.booking_policy));

  v_open := public.booking_open_at(v_sched.start_time, v_policy);
  v_close := public.booking_close_at(v_sched.start_time, v_policy);
  if v_open is not null and now() < v_open then
    raise exception 'BOOKING_NOT_YET_OPEN' using errcode = 'check_violation'; end if;
  if now() >= v_close then
    raise exception 'BOOKING_CLOSED' using errcode = 'check_violation'; end if;

  if p_order_item_id is not null then
    select src.result_user_ticket_id into v_designated
      from public.order_items oi
      join public.order_items src on src.id = oi.source_purchase_item_id
     where oi.id = p_order_item_id;
  end if;
  if v_designated is null then v_designated := p_user_ticket_id; end if;

  if v_designated is null then
    select ut.* into v_ut from public.user_tickets ut
      join public.tickets t on t.id = ut.ticket_id
     where ut.user_id = v_user_id and coalesce(ut.status,'ACTIVE') = 'ACTIVE'
       and (ut.fixed_class_id is null or ut.fixed_class_id = v_class.id)
       and ((ut.start_date is null and ut.expiry_date is null)
            or ((ut.start_date is null or ut.start_date <= v_class_date)
                and (ut.expiry_date is null or ut.expiry_date >= v_class_date)))
       and (upper(t.ticket_type) = 'PERIOD' or coalesce(ut.remaining_count,0) > 0)
       and public.booking_ticket_covers_class(t.id, v_class.id)
     order by (upper(t.ticket_type) = 'PERIOD') desc,
              coalesce(ut.expiry_date, '9999-12-31'::date) asc, ut.id asc
     limit 1;
    if not found then raise exception 'NO_USABLE_TICKET' using errcode = 'check_violation'; end if;
  else
    select ut.* into v_ut from public.user_tickets ut
      where ut.id = v_designated and ut.user_id = v_user_id;
    if not found then raise exception 'USER_TICKET_NOT_FOUND' using errcode = 'no_data_found'; end if;
  end if;

  select * into v_ticket from public.tickets where id = v_ut.ticket_id;

  if v_ut.fixed_class_id is not null and v_ut.fixed_class_id <> v_class.id then
    raise exception 'FIXED_CLASS_MISMATCH' using errcode = 'check_violation'; end if;

  if v_group_is_special then
    select exists(select 1 from public.ticket_classes tc
                   where tc.ticket_id = v_ticket.id and tc.class_id = v_class.id)
        or exists(select 1 from public.ticket_coverage tv
                   where tv.ticket_id = v_ticket.id and tv.is_active
                     and tv.class_group_id = v_class.class_group_id)
      into v_has_explicit;
    if not v_has_explicit then
      raise exception 'SPECIAL_CLASS_NOT_COVERED' using errcode = 'check_violation'; end if;
  end if;

  v_covered := public.booking_ticket_covers_class(v_ticket.id, v_class.id);
  if not v_covered then raise exception 'TICKET_NOT_COVERED' using errcode = 'check_violation'; end if;

  if not (v_ut.start_date is null and v_ut.expiry_date is null) then
    if v_ut.start_date is not null and v_ut.start_date > v_class_date then
      raise exception 'TICKET_NOT_STARTED' using errcode = 'check_violation'; end if;
    if v_ut.expiry_date is not null and v_ut.expiry_date < v_class_date then
      raise exception 'TICKET_EXPIRED' using errcode = 'check_violation'; end if;
  end if;
  if coalesce(v_ut.status,'ACTIVE') <> 'ACTIVE' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'check_violation'; end if;

  if exists (select 1 from public.bookings b
     where b.schedule_id = p_schedule_id and b.user_id = v_user_id
       and (b.status in ('CONFIRMED','COMPLETED')
            or (b.status='PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()))
  ) then raise exception 'DUPLICATE_BOOKING' using errcode = 'unique_violation'; end if;

  v_cap := coalesce(v_sched.max_students, 2147483647);
  select count(*) into v_cur from public.bookings b
   where b.schedule_id = p_schedule_id
     and (b.status in ('CONFIRMED','COMPLETED')
          or (b.status='PENDING' and b.hold_expires_at is not null and b.hold_expires_at > now()));
  if v_cur >= v_cap then raise exception 'SCHEDULE_FULL' using errcode = 'check_violation'; end if;

  if upper(coalesce(v_ticket.ticket_type,'')) = 'COUNT' then
    update public.user_tickets
       set remaining_count = remaining_count - 1,
           status = case when (remaining_count - 1) <= 0 then 'USED' else status end
     where id = v_ut.id and status = 'ACTIVE'
       and remaining_count is not null and remaining_count >= 1;
    if not found then raise exception 'INSUFFICIENT_TICKET_COUNT' using errcode = 'check_violation'; end if;
    v_deducted := true;
  end if;

  if coalesce(v_ticket.start_mode,'IMMEDIATE') = 'FIRST_BOOKING'
     and v_ut.start_date is null and v_ut.expiry_date is null then
    v_new_start := v_class_date;
    if v_ticket.valid_months is not null then
      v_new_expiry := public.kst_months_expiry(v_new_start, v_ticket.valid_months);
    elsif v_ticket.valid_days is not null then
      v_new_expiry := public.kst_inclusive_expiry(v_new_start, v_ticket.valid_days);
    else v_new_expiry := null; end if;
    update public.user_tickets set start_date = v_new_start, expiry_date = v_new_expiry where id = v_ut.id;
    v_started := true;
  end if;

  insert into public.bookings (user_id, class_id, schedule_id, user_ticket_id, status, payment_status)
  values (v_user_id, v_class.id, p_schedule_id, v_ut.id, 'CONFIRMED', 'PAID')
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'user_ticket_id', v_ut.id,
    'deducted', v_deducted, 'ticket_started', v_started,
    'start_date', v_new_start, 'expiry_date', v_new_expiry, 'class_date', v_class_date);
end $function$
;

CREATE OR REPLACE FUNCTION public.cancel_booking_tx(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_is_service boolean := public.booking_is_service_role();
  v_b public.bookings; v_class record; v_sched record; v_policy jsonb;
  v_deadline timestamptz; v_within boolean := false; v_ticket record;
  v_restored boolean := false; v_updated public.bookings;
begin
  select * into v_b from public.bookings where id = p_booking_id;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found'; end if;

  select c.* into v_class from public.classes c where c.id = v_b.class_id;

  if not v_is_service
     and (v_caller is null or v_b.user_id is distinct from v_caller)
     and not (v_class.academy_id is not null
              and (public.is_academy_staff(v_class.academy_id) or public.is_super_admin())) then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  if v_b.status not in ('CONFIRMED','PENDING','CANCELLED') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation'; end if;

  if v_b.schedule_id is not null then
    select * into v_sched from public.schedules where id = v_b.schedule_id for update;
    if found then
      select public.booking_resolve_policy(a.booking_policy, v_class.booking_policy) into v_policy
        from public.academies a where a.id = v_class.academy_id;
      v_policy := coalesce(v_policy, public.booking_resolve_policy(null, v_class.booking_policy));
      v_deadline := public.booking_cancel_deadline_at(v_sched.start_time, v_policy);
      v_within := now() < v_deadline;
    end if;
  end if;

  update public.bookings set status = 'CANCELLED'
   where id = p_booking_id and status <> 'CANCELLED' returning * into v_updated;

  if not found then
    return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'already_cancelled', true,
      'restored', false, 'within_deadline', v_within);
  end if;

  if v_within and v_b.user_ticket_id is not null then
    select t.* into v_ticket from public.user_tickets ut
      join public.tickets t on t.id = ut.ticket_id where ut.id = v_b.user_ticket_id;
    if found and upper(coalesce(v_ticket.ticket_type,'')) = 'COUNT' then
      update public.user_tickets
         set remaining_count = coalesce(remaining_count,0) + 1,
             status = case when status='USED' and (coalesce(remaining_count,0)+1) > 0
                           then 'ACTIVE' else status end
       where id = v_b.user_ticket_id and remaining_count is not null;
      if found then v_restored := true; end if;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'already_cancelled', false,
    'restored', v_restored, 'within_deadline', v_within);
end $function$
;

-- 권한: anon 은 예약 엔진을 실행할 수 없다 (SECURITY DEFINER 우회 차단)
revoke all on function public.create_booking_tx(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.cancel_booking_tx(uuid) from public, anon;
revoke all on function public.booking_ticket_covers_class(uuid, uuid) from public, anon;
revoke all on function public.booking_is_service_role() from public, anon;
grant execute on function public.create_booking_tx(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.cancel_booking_tx(uuid) to authenticated, service_role;
grant execute on function public.booking_ticket_covers_class(uuid, uuid) to authenticated, service_role;
grant execute on function public.booking_is_service_role() to authenticated, service_role;
grant execute on function public.kst_date(timestamptz) to authenticated, service_role;
grant execute on function public.booking_resolve_policy(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.booking_open_at(timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.booking_close_at(timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.booking_cancel_deadline_at(timestamptz, jsonb) to authenticated, service_role;
