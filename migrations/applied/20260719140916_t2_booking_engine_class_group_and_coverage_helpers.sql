-- T2-1: classes.class_group_id (additive) + coverage/policy helper functions.

alter table public.classes
  add column if not exists class_group_id uuid references public.class_groups(id) on delete set null;

create index if not exists idx_classes_class_group_id on public.classes(class_group_id);

-- ---------------------------------------------------------------------------
-- KST helpers
-- ---------------------------------------------------------------------------
create or replace function public.kst_date(p_ts timestamptz)
returns date language sql immutable as $$
  select (p_ts at time zone 'Asia/Seoul')::date;
$$;

-- 신규 규칙: 시작일 포함 만료 (start + valid_days - 1)
create or replace function public.kst_inclusive_expiry(p_start date, p_valid_days int)
returns date language sql immutable as $$
  select p_start + (p_valid_days - 1);
$$;

-- 달력 개월 만료: start + N months - 1 day
create or replace function public.kst_months_expiry(p_start date, p_valid_months int)
returns date language sql immutable as $$
  select (p_start + (p_valid_months || ' months')::interval)::date - 1;
$$;

-- ---------------------------------------------------------------------------
-- 커버리지 체인 (TS lib/booking/coverage.ts 와 1:1 대응)
--   (1) ticket_classes  (2) ticket_coverage  (3) 레거시 is_general
-- ---------------------------------------------------------------------------
create or replace function public.booking_ticket_covers_class(p_ticket_id uuid, p_class_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
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
end $$;

-- ---------------------------------------------------------------------------
-- booking_policy 필드 단위 병합 (academy 기본 → class 오버라이드)
-- ---------------------------------------------------------------------------
create or replace function public.booking_resolve_policy(p_academy jsonb, p_class jsonb)
returns jsonb language plpgsql immutable as $$
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
end $$;

-- 예약 오픈 시각 (null = 항상 열림)
create or replace function public.booking_open_at(p_start timestamptz, p_policy jsonb)
returns timestamptz language plpgsql immutable as $$
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
end $$;

create or replace function public.booking_close_at(p_start timestamptz, p_policy jsonb)
returns timestamptz language sql immutable as $$
  select p_start - (coalesce((p_policy->'close'->>'minutesBefore')::int, 0) || ' minutes')::interval;
$$;

create or replace function public.booking_cancel_deadline_at(p_start timestamptz, p_policy jsonb)
returns timestamptz language sql immutable as $$
  select p_start - (coalesce((p_policy->'cancelUntil'->>'minutesBefore')::int, 0) || ' minutes')::interval;
$$;

revoke all on function public.booking_ticket_covers_class(uuid, uuid) from public;
grant execute on function public.booking_ticket_covers_class(uuid, uuid) to authenticated, service_role;
grant execute on function public.kst_date(timestamptz) to authenticated, service_role;
grant execute on function public.booking_resolve_policy(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.booking_open_at(timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.booking_close_at(timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.booking_cancel_deadline_at(timestamptz, jsonb) to authenticated, service_role;;