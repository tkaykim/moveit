-- ============================================================================
-- T3 멤버십 도메인 (원자적 부여 / 상태전이 / 자격 판정)
-- 모두 additive. 기존 데이터 삭제·변경 없음.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 자격(audience) 단일 정본: ACTIVE 멤버십만 인정
--    create_booking_tx 가 인라인으로 갖고 있던 규칙을 이 함수로 끌어낸다(중복 제거).
-- ---------------------------------------------------------------------------
create or replace function public.has_active_membership(
  p_user_id uuid,
  p_membership_id uuid,
  p_on_date date default null
) returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date := coalesce(p_on_date, public.kst_date(now()));
  v_academy uuid;
begin
  if p_user_id is null or p_membership_id is null then
    return false;
  end if;

  -- 명시적 내부 권한 검사: 서비스롤 / 본인 / 해당 학원 스태프 / 슈퍼관리자만.
  if not public.booking_is_service_role() then
    select m.academy_id into v_academy from public.memberships m where m.id = p_membership_id;
    if not (
      auth.uid() = p_user_id
      or (v_academy is not null and public.is_academy_staff(v_academy))
      or public.is_super_admin()
    ) then
      raise exception 'NOT_AUTHORIZED' using errcode = 'insufficient_privilege';
    end if;
  end if;

  return exists (
    select 1 from public.student_memberships sm
     where sm.user_id = p_user_id
       and sm.membership_id = p_membership_id
       and sm.status = 'ACTIVE'          -- SUSPENDED / EXPIRED 는 아무 권리도 주지 않는다
       and sm.start_date <= v_date
       and (sm.end_date is null or sm.end_date >= v_date)
  );
end $$;

revoke all on function public.has_active_membership(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.has_active_membership(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) 원자적 부여: student_memberships + 번들 user_tickets 를 한 트랜잭션에서.
--    둘 중 하나만 남는 상태는 존재할 수 없다.
-- ---------------------------------------------------------------------------
create or replace function public.grant_student_membership(
  p_academy_id uuid,
  p_user_id uuid,
  p_membership_id uuid,
  p_start_date date default null,
  p_end_date date default null,
  p_note text default null,
  p_remaining_count integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_service boolean := public.booking_is_service_role();
  v_today date := public.kst_date(now());
  v_start date;
  v_m record;
  v_t record;
  v_sm public.student_memberships;
  v_ut public.user_tickets;
  v_ut_id uuid := null;
  v_ut_start date := null;
  v_ut_expiry date := null;
  v_count integer := null;
begin
  if not v_is_service then
    if auth.uid() is null then
      raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
    end if;
    if not (public.is_academy_staff(p_academy_id) or public.is_super_admin()) then
      raise exception 'NOT_ACADEMY_STAFF' using errcode = 'insufficient_privilege';
    end if;
  end if;

  if p_academy_id is null or p_user_id is null or p_membership_id is null then
    raise exception 'INVALID_ARGUMENT' using errcode = 'check_violation';
  end if;

  v_start := coalesce(p_start_date, v_today);
  if p_end_date is not null and p_end_date < v_start then
    raise exception 'INVALID_DATE_RANGE' using errcode = 'check_violation';
  end if;

  select * into v_m from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_m.academy_id is distinct from p_academy_id then
    raise exception 'MEMBERSHIP_ACADEMY_MISMATCH' using errcode = 'check_violation';
  end if;
  if not v_m.is_active then
    raise exception 'MEMBERSHIP_INACTIVE' using errcode = 'check_violation';
  end if;

  -- 도메인 에러로 선검사 (부분 유니크 인덱스 위반 원문을 그대로 노출하지 않는다)
  if exists (
    select 1 from public.student_memberships sm
     where sm.academy_id = p_academy_id and sm.user_id = p_user_id and sm.status = 'ACTIVE'
  ) then
    raise exception 'ALREADY_ACTIVE_MEMBERSHIP' using errcode = 'unique_violation';
  end if;

  -- (a) 멤버십 행 먼저 삽입한다. 이후 단계가 실패하면 이 행도 함께 롤백된다 —
  --     "멤버십만 남고 번들 수강권은 없는" 상태를 구조적으로 불가능하게 만든다.
  begin
    insert into public.student_memberships
      (academy_id, user_id, membership_id, status, start_date, end_date, granted_by, note)
    values
      (p_academy_id, p_user_id, p_membership_id, 'ACTIVE', v_start, p_end_date, auth.uid(), p_note)
    returning * into v_sm;
  exception when unique_violation then
    raise exception 'ALREADY_ACTIVE_MEMBERSHIP' using errcode = 'unique_violation';
  end;

  -- (b) 번들 수강권 발급
  if v_m.bundled_ticket_id is not null then
    select * into v_t from public.tickets where id = v_m.bundled_ticket_id;
    if not found or v_t.academy_id is distinct from p_academy_id then
      raise exception 'BUNDLED_TICKET_INVALID' using errcode = 'check_violation';
    end if;

    -- start_mode 존중: IMMEDIATE = 지금 날짜 확정 / FIRST_BOOKING = 첫 예약까지 NULL
    if coalesce(v_t.start_mode, 'IMMEDIATE') = 'FIRST_BOOKING' then
      v_ut_start := null;
      v_ut_expiry := null;
    else
      v_ut_start := v_start;
      if v_t.valid_months is not null then
        v_ut_expiry := public.kst_months_expiry(v_ut_start, v_t.valid_months);
      elsif v_t.valid_days is not null then
        -- 신규 발급은 T2 의 inclusive 규칙 (레거시 저장값 의미는 건드리지 않는다)
        v_ut_expiry := public.kst_inclusive_expiry(v_ut_start, v_t.valid_days);
      else
        v_ut_expiry := null;
      end if;
    end if;

    if upper(coalesce(v_t.ticket_type, '')) = 'COUNT' then
      v_count := coalesce(p_remaining_count, v_t.total_count, 0);
    else
      v_count := null;
    end if;

    insert into public.user_tickets
      (user_id, ticket_id, remaining_count, start_date, expiry_date, status, source_membership_id)
    values
      (p_user_id, v_t.id, v_count, v_ut_start, v_ut_expiry, 'ACTIVE', p_membership_id)
    returning * into v_ut;
    v_ut_id := v_ut.id;

    -- (c) 양방향 교차링크 완성
    update public.student_memberships
       set bundled_user_ticket_id = v_ut_id, updated_at = now()
     where id = v_sm.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'student_membership_id', v_sm.id,
    'membership_id', p_membership_id,
    'user_id', p_user_id,
    'status', 'ACTIVE',
    'start_date', v_start,
    'end_date', p_end_date,
    'bundled_user_ticket_id', v_ut_id,
    'bundled_ticket_start_date', v_ut_start,
    'bundled_ticket_expiry_date', v_ut_expiry
  );
end $$;

revoke all on function public.grant_student_membership(uuid, uuid, uuid, date, date, text, integer) from public, anon, authenticated;
grant execute on function public.grant_student_membership(uuid, uuid, uuid, date, date, text, integer) to authenticated;
;