-- classes.title 은 varchar 이므로 선언된 text 반환형에 맞게 명시 캐스팅한다.
create or replace function public.claim_class_cancel_notifications(p_limit integer default 500)
returns table (
  restoration_id uuid,
  academy_id uuid,
  user_id uuid,
  schedule_id uuid,
  booking_id uuid,
  restore_kind text,
  detail text,
  class_name text,
  start_time timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.booking_is_service_role() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  return query
  with claimed as (
    update public.class_cancel_restorations r
       set notified_at = now()
     where r.id in (
       select r2.id from public.class_cancel_restorations r2
        where r2.notified_at is null
        order by r2.created_at asc
        limit greatest(coalesce(p_limit, 500), 1)
        for update skip locked
     )
    returning r.id, r.academy_id, r.user_id, r.schedule_id, r.booking_id, r.restore_kind, r.detail
  )
  select c.id::uuid, c.academy_id::uuid, c.user_id::uuid, c.schedule_id::uuid, c.booking_id::uuid,
         c.restore_kind::text, c.detail::text,
         cl.title::text, s.start_time::timestamptz
    from claimed c
    left join public.schedules s on s.id = c.schedule_id
    left join public.classes cl on cl.id = s.class_id;
end $$;

revoke all on function public.claim_class_cancel_notifications(integer) from public, anon, authenticated;
;