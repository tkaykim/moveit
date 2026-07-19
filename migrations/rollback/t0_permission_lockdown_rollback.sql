-- T0 rollback — 핵심 권한 잠금 되돌리기
-- 아래 정의는 마이그레이션 적용 직전 pg_policies / pg_get_functiondef 에서 그대로 캡처한 원본이다.
--
-- 주의: audience_membership_id 컬럼은 의도적으로 DROP 하지 않는다.
--       (additive-only 원칙 / 컬럼 드롭은 파괴적 작업)
--       필요 시 수동으로: alter table public.classes drop column audience_membership_id;

begin;

-- ---------------------------------------------------------------------------
-- 1. user_tickets: ut_insert 원복
-- ---------------------------------------------------------------------------
drop policy if exists ut_insert_staff on public.user_tickets;

create policy ut_insert on public.user_tickets
  for insert to authenticated
  with check (
    (user_id = auth.uid())
    or is_super_admin()
    or is_academy_staff((select t.academy_id from tickets t where t.id = user_tickets.ticket_id))
  );

-- ---------------------------------------------------------------------------
-- 2. bookings: bookings_update 원복 (학생 self-update 포함)
-- ---------------------------------------------------------------------------
drop policy if exists bookings_update on public.bookings;

create policy bookings_update on public.bookings
  for update to public
  using ((user_id = auth.uid()) or can_staff_booking(class_id) or is_super_admin())
  with check ((user_id = auth.uid()) or can_staff_booking(class_id) or is_super_admin());

drop function if exists public.cancel_my_booking(uuid);

-- ---------------------------------------------------------------------------
-- 3. classes / schedules: 무조건 공개 SELECT 원복
-- ---------------------------------------------------------------------------
drop policy if exists classes_select_public on public.classes;

create policy classes_select_public on public.classes
  for select to anon, authenticated
  using (true);

drop policy if exists schedules_select_public on public.schedules;

create policy schedules_select_public on public.schedules
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4. 티켓 카운트 RPC: 원래 GRANT / search_path 원복
-- ---------------------------------------------------------------------------
-- 원본 ACL: =X/postgres | postgres=X/postgres | anon=X/postgres
--           | authenticated=X/postgres | service_role=X/postgres
-- 원본 proconfig: search_path=public
alter function public.consume_ticket_count(uuid, integer) set search_path = public;
alter function public.restore_ticket_count(uuid, integer) set search_path = public;

grant execute on function public.consume_ticket_count(uuid, integer) to public, anon, authenticated, service_role;
grant execute on function public.restore_ticket_count(uuid, integer) to public, anon, authenticated, service_role;

drop function if exists public.restore_ticket_count_staff(uuid, integer);

commit;

-- ---------------------------------------------------------------------------
-- 참고: 원본 함수 본문 (변경하지 않았으므로 복원 불필요, 기록용)
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.consume_ticket_count(p_user_ticket_id uuid, p_count integer DEFAULT 1)
--  RETURNS user_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- declare r public.user_tickets;
-- begin
--   update public.user_tickets
--      set remaining_count = remaining_count - p_count,
--          status = case when (remaining_count - p_count) <= 0 then 'USED' else status end
--    where id = p_user_ticket_id
--      and status = 'ACTIVE'
--      and remaining_count is not null
--      and remaining_count >= p_count
--   returning * into r;
--   if not found then
--     raise exception 'INSUFFICIENT_TICKET_COUNT' using errcode = 'check_violation';
--   end if;
--   return r;
-- end $function$
--
-- CREATE OR REPLACE FUNCTION public.restore_ticket_count(p_user_ticket_id uuid, p_count integer DEFAULT 1)
--  RETURNS user_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- declare r public.user_tickets;
-- begin
--   update public.user_tickets
--      set remaining_count = coalesce(remaining_count, 0) + p_count,
--          status = case
--                     when status = 'USED' and (coalesce(remaining_count,0) + p_count) > 0 then 'ACTIVE'
--                     else status
--                   end
--    where id = p_user_ticket_id
--      and remaining_count is not null
--   returning * into r;
--   return r;
-- end $function$
