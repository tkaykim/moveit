-- T7-3b. CLASS_CANCELED 이벤트 프로세서 (cron). 멱등.
-- 예약당 복구는 class_cancel_restorations.booking_id UNIQUE 로 정확히 1회만 일어난다.
-- 알림은 notified_at 스탬프로 정확히 1회만 나간다(발송은 앱 계층이 담당).
create or replace function public.process_class_canceled_events(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ev         record;
  v_sched      public.schedules;
  v_academy    uuid;
  v_bk         record;
  v_ut         public.user_tickets;
  v_ticket     public.tickets;
  v_type       text;
  v_kind       text;
  v_detail     text;
  v_ext_days   int;
  v_inserted   uuid;
  v_processed  int := 0;
  v_failed     int := 0;
  v_restored   int := 0;
  v_count_rest int := 0;
  v_period_ext int := 0;
  v_replaced   int := 0;
  v_skipped    int := 0;
  v_place      jsonb;
  v_err        text;
begin
  if not public.booking_is_service_role() then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  for v_ev in
    select id, schedule_id, academy_id, attempts
      from public.booking_events
     where status = 'PENDING' and event_type = 'CLASS_CANCELED'
     order by created_at asc
     limit greatest(coalesce(p_limit, 200), 1)
     for update skip locked
  loop
    begin
      select * into v_sched from public.schedules where id = v_ev.schedule_id;
      v_academy := v_ev.academy_id;

      if found then
        for v_bk in
          select b.id, b.user_id, b.user_ticket_id, b.status
            from public.bookings b
           where b.schedule_id = v_sched.id
             and b.status in ('PENDING', 'CONFIRMED')
           order by b.created_at asc
        loop
          v_kind := 'NONE';
          v_detail := null;

          -- 예약당 정확히 1회: 원장 선점에 성공한 경우에만 실제 복구를 수행한다.
          insert into public.class_cancel_restorations (
            academy_id, event_id, schedule_id, booking_id, user_id, user_ticket_id, restore_kind
          ) values (
            v_academy, v_ev.id, v_sched.id, v_bk.id, v_bk.user_id, v_bk.user_ticket_id, 'PENDING'
          )
          on conflict (booking_id) do nothing
          returning id into v_inserted;

          if v_inserted is null then
            v_skipped := v_skipped + 1;
            continue;
          end if;

          update public.bookings set status = 'CANCELLED' where id = v_bk.id;

          if v_bk.user_ticket_id is not null then
            select * into v_ut from public.user_tickets where id = v_bk.user_ticket_id;
            if found then
              select * into v_ticket from public.tickets where id = v_ut.ticket_id;
              v_type := upper(coalesce(v_ticket.ticket_type, ''));

              if v_type = 'COUNT' then
                update public.user_tickets
                   set remaining_count = coalesce(remaining_count, 0) + 1
                 where id = v_ut.id;
                v_kind := 'COUNT_RESTORED';
                v_detail := '휴강으로 차감 회차 1회 복구';
                v_count_rest := v_count_rest + 1;
              else
                -- 기간제: 잃어버린 수업일만큼 유효기간 연장.
                -- 고정 주1회는 주 단위 편성이므로 +7일이라야 회차 1개를 다시 얻는다.
                v_ext_days := case when coalesce(v_ticket.is_fixed_weekly, false) then 7 else 1 end;
                if v_ut.expiry_date is not null then
                  update public.user_tickets
                     set expiry_date = v_ut.expiry_date + v_ext_days
                   where id = v_ut.id;
                end if;
                v_kind := 'PERIOD_EXTENDED';
                v_detail := format('휴강으로 유효기간 %s일 연장', v_ext_days);
                v_period_ext := v_period_ext + 1;
              end if;

              -- 고정 주1회는 T6 배치 경로를 그대로 재사용해 대체 회차를 다시 잡는다.
              if coalesce(v_ticket.is_fixed_weekly, false) and v_ut.fixed_class_id is not null then
                v_place := public.place_fixed_weekly_bookings(v_ut.id);
                if coalesce((v_place->>'placed')::int, 0) > 0 then
                  v_replaced := v_replaced + coalesce((v_place->>'placed')::int, 0);
                  v_detail := coalesce(v_detail, '') || ' · 대체 회차 자동 배치';
                end if;
              end if;
            end if;
          end if;

          update public.class_cancel_restorations
             set restore_kind = v_kind, detail = v_detail
           where id = v_inserted;
          v_restored := v_restored + 1;
        end loop;
      end if;

      update public.booking_events
         set status = 'PROCESSED', processed_at = now(),
             attempts = attempts + 1, last_error = null
       where id = v_ev.id;
      v_processed := v_processed + 1;

    exception when others then
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
    'restored', v_restored, 'count_restored', v_count_rest,
    'period_extended', v_period_ext, 'replacement_placed', v_replaced,
    'already_restored', v_skipped
  );
end $$;

revoke all on function public.process_class_canceled_events(integer) from public, anon, authenticated;
;