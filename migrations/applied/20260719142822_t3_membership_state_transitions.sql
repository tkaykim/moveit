-- ============================================================================
-- T3 멤버십 상태 전이 (suspend / resume / extend / expire)
-- 불변 규칙: EXPIRED·SUSPENDED 로 가더라도 번들 수강권은 회수하지 않는다.
--            (이미 부여된 계약상 혜택 — 수강권은 자기 만료일을 따른다)
--            학생의 미래 예약도 자동 취소하지 않는다.
-- ============================================================================

create or replace function public.membership_assert_staff(p_academy_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.booking_is_service_role() then return; end if;
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;
  if not (public.is_academy_staff(p_academy_id) or public.is_super_admin()) then
    raise exception 'NOT_ACADEMY_STAFF' using errcode = 'insufficient_privilege';
  end if;
end $$;

revoke all on function public.membership_assert_staff(uuid) from public, anon, authenticated;

-- ACTIVE → SUSPENDED
create or replace function public.suspend_student_membership(
  p_student_membership_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_sm public.student_memberships;
begin
  select * into v_sm from public.student_memberships where id = p_student_membership_id for update;
  if not found then
    raise exception 'STUDENT_MEMBERSHIP_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  perform public.membership_assert_staff(v_sm.academy_id);

  if v_sm.status <> 'ACTIVE' then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation';
  end if;

  update public.student_memberships
     set status = 'SUSPENDED',
         note = coalesce(p_note, note),
         updated_at = now()
   where id = p_student_membership_id
  returning * into v_sm;

  -- 번들 수강권은 손대지 않는다.
  return jsonb_build_object('ok', true, 'student_membership_id', v_sm.id, 'status', v_sm.status,
    'bundled_user_ticket_id', v_sm.bundled_user_ticket_id);
end $$;

revoke all on function public.suspend_student_membership(uuid, text) from public, anon, authenticated;
grant execute on function public.suspend_student_membership(uuid, text) to authenticated;

-- SUSPENDED → ACTIVE (그 학생+학원에 다른 ACTIVE 멤버십이 없을 때만)
create or replace function public.resume_student_membership(
  p_student_membership_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_sm public.student_memberships;
begin
  select * into v_sm from public.student_memberships where id = p_student_membership_id for update;
  if not found then
    raise exception 'STUDENT_MEMBERSHIP_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  perform public.membership_assert_staff(v_sm.academy_id);

  if v_sm.status <> 'SUSPENDED' then
    raise exception 'INVALID_STATE_TRANSITION' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.student_memberships o
     where o.academy_id = v_sm.academy_id and o.user_id = v_sm.user_id
       and o.status = 'ACTIVE' and o.id <> v_sm.id
  ) then
    raise exception 'ALREADY_ACTIVE_MEMBERSHIP' using errcode = 'unique_violation';
  end if;

  begin
    update public.student_memberships
       set status = 'ACTIVE', note = coalesce(p_note, note), updated_at = now()
     where id = p_student_membership_id
    returning * into v_sm;
  exception when unique_violation then
    raise exception 'ALREADY_ACTIVE_MEMBERSHIP' using errcode = 'unique_violation';
  end;

  return jsonb_build_object('ok', true, 'student_membership_id', v_sm.id, 'status', v_sm.status);
end $$;

revoke all on function public.resume_student_membership(uuid, text) from public, anon, authenticated;
grant execute on function public.resume_student_membership(uuid, text) to authenticated;

-- 연장 = end_date 갱신 (스태프 액션). EXPIRED 였다면 ACTIVE 로 되살릴 수 있다.
create or replace function public.extend_student_membership(
  p_student_membership_id uuid,
  p_end_date date,
  p_reactivate boolean default false,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sm public.student_memberships;
  v_new_status text;
begin
  select * into v_sm from public.student_memberships where id = p_student_membership_id for update;
  if not found then
    raise exception 'STUDENT_MEMBERSHIP_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  perform public.membership_assert_staff(v_sm.academy_id);

  if p_end_date is not null and p_end_date < v_sm.start_date then
    raise exception 'INVALID_DATE_RANGE' using errcode = 'check_violation';
  end if;

  v_new_status := v_sm.status;
  if p_reactivate and v_sm.status = 'EXPIRED' then
    if exists (
      select 1 from public.student_memberships o
       where o.academy_id = v_sm.academy_id and o.user_id = v_sm.user_id
         and o.status = 'ACTIVE' and o.id <> v_sm.id
    ) then
      raise exception 'ALREADY_ACTIVE_MEMBERSHIP' using errcode = 'unique_violation';
    end if;
    v_new_status := 'ACTIVE';
  end if;

  update public.student_memberships
     set end_date = p_end_date, status = v_new_status,
         note = coalesce(p_note, note), updated_at = now()
   where id = p_student_membership_id
  returning * into v_sm;

  return jsonb_build_object('ok', true, 'student_membership_id', v_sm.id,
    'status', v_sm.status, 'end_date', v_sm.end_date);
end $$;

revoke all on function public.extend_student_membership(uuid, date, boolean, text) from public, anon, authenticated;
grant execute on function public.extend_student_membership(uuid, date, boolean, text) to authenticated;

-- 만료 스윕 (cron 전용). ACTIVE|SUSPENDED → EXPIRED. 번들 수강권은 그대로 둔다.
create or replace function public.expire_student_memberships(
  p_academy_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := public.kst_date(now());
  v_ids uuid[];
begin
  if not (public.booking_is_service_role() or public.is_super_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
  end if;

  with swept as (
    update public.student_memberships sm
       set status = 'EXPIRED', updated_at = now()
     where sm.status in ('ACTIVE', 'SUSPENDED')
       and sm.end_date is not null
       and sm.end_date < v_today
       and (p_academy_id is null or sm.academy_id = p_academy_id)
    returning sm.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from swept;

  return jsonb_build_object('ok', true, 'sweep_date', v_today,
    'expired', coalesce(array_length(v_ids, 1), 0), 'ids', to_jsonb(v_ids));
end $$;

revoke all on function public.expire_student_memberships(uuid) from public, anon, authenticated;
;