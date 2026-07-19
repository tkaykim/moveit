alter table public.classes
  add column if not exists audience_membership_id uuid;

comment on column public.classes.audience_membership_id is
  'NULL = public class. NOT NULL = membership-restricted (currently academy staff only). memberships FK added in a later task.';

create index if not exists idx_classes_audience_membership_id
  on public.classes (audience_membership_id)
  where audience_membership_id is not null;

drop policy if exists ut_insert on public.user_tickets;

create policy ut_insert_staff on public.user_tickets
  for insert to authenticated
  with check (
    public.is_super_admin()
    or public.is_academy_staff((select t.academy_id from public.tickets t where t.id = user_tickets.ticket_id))
  );

drop policy if exists bookings_update on public.bookings;

create policy bookings_update on public.bookings
  for update to public
  using (public.can_staff_booking(class_id) or public.is_super_admin())
  with check (public.can_staff_booking(class_id) or public.is_super_admin());

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
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select * into b from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if b.user_id is distinct from auth.uid() then
    raise exception 'NOT_BOOKING_OWNER' using errcode = 'insufficient_privilege';
  end if;

  if b.status not in ('CONFIRMED', 'PENDING') then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation';
  end if;

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

drop policy if exists classes_select_public on public.classes;

create policy classes_select_public on public.classes
  for select to anon, authenticated
  using (
    audience_membership_id is null
    or public.is_academy_staff(academy_id)
    or public.is_super_admin()
  );

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

alter function public.consume_ticket_count(uuid, integer) set search_path = public, pg_temp;
alter function public.restore_ticket_count(uuid, integer) set search_path = public, pg_temp;

revoke execute on function public.consume_ticket_count(uuid, integer) from public, anon, authenticated;
revoke execute on function public.restore_ticket_count(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ticket_count(uuid, integer) to service_role;
grant execute on function public.restore_ticket_count(uuid, integer) to service_role;

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
     and remaining_count is not null
  returning * into r;

  return r;
end
$function$;

revoke all on function public.restore_ticket_count_staff(uuid, integer) from public, anon;
grant execute on function public.restore_ticket_count_staff(uuid, integer) to authenticated, service_role;;