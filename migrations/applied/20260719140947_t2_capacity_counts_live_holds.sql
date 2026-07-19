-- T2-2: 정원 계산에 "살아있는 PENDING 홀드"를 포함한다.
--   좌석 점유 = CONFIRMED | COMPLETED | (PENDING and hold_expires_at > now())
-- hold_expires_at 이 NULL 인 기존 PENDING(계좌이체 레거시)은 점유로 보지 않는다 → 기존 동작 불변.

create or replace function public.trg_enforce_schedule_capacity()
returns trigger language plpgsql as $$
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
end $$;

-- current_students 도 동일 규칙으로 유지 (두 곳이 어긋나지 않게)
create or replace function public.trg_sync_schedule_student_count()
returns trigger language plpgsql as $$
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
end $$;;