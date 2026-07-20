-- T7-3. 휴강(schedules.is_canceled false→true) 전파.
-- 외부 일정툴이 service_role 로 DB 를 직접 수정하므로 앱 훅이 아니라 DB 트리거로 감지한다.
-- 트리거는 "이벤트 기록만" 한다 (HTTP·무거운 작업 금지 — T6 SCHEDULE_CREATED 와 동일 규율).

-- 같은 회차에 대한 CLASS_CANCELED 이벤트는 영구히 1건만 존재한다.
-- (false→true→false→true 재전환에도 중복 생성되지 않는다)
create unique index if not exists uq_booking_events_class_canceled
  on public.booking_events (schedule_id)
  where event_type = 'CLASS_CANCELED';

create or replace function public.trg_schedule_canceled_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_academy uuid;
begin
  -- false/null → true 전환만
  if coalesce(OLD.is_canceled, false) = true or coalesce(NEW.is_canceled, false) = false then
    return NEW;
  end if;

  select c.academy_id into v_academy from public.classes c where c.id = NEW.class_id;
  if v_academy is null then return NEW; end if;

  insert into public.booking_events (academy_id, event_type, schedule_id, status)
  values (v_academy, 'CLASS_CANCELED', NEW.id, 'PENDING')
  on conflict do nothing;

  return NEW;
end $$;

drop trigger if exists schedules_canceled_event on public.schedules;
create trigger schedules_canceled_event
  after update of is_canceled on public.schedules
  for each row execute function public.trg_schedule_canceled_event();

-- 예약 단위 복구 원장. booking_id UNIQUE 가 "예약당 정확히 1회 복구"를 물리적으로 보장한다.
create table if not exists public.class_cancel_restorations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  event_id uuid not null references public.booking_events(id) on delete cascade,
  schedule_id uuid not null,
  booking_id uuid not null unique,
  user_id uuid not null,
  user_ticket_id uuid,
  restore_kind text not null,
  detail text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ccr_event on public.class_cancel_restorations (event_id);
create index if not exists idx_ccr_pending_notify on public.class_cancel_restorations (notified_at) where notified_at is null;

alter table public.class_cancel_restorations enable row level security;

drop policy if exists ccr_staff_select on public.class_cancel_restorations;
create policy ccr_staff_select on public.class_cancel_restorations
  for select to authenticated
  using (public.is_academy_staff(academy_id) or public.is_super_admin());
;