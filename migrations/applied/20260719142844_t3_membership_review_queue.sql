-- ============================================================================
-- T3 만료 멤버십 검토 큐 (데이터 계층만 — UI 는 후속 태스크)
-- "멤버십은 만료됐는데 멤버십 전용 수업의 미래 예약을 아직 들고 있는 학생"
-- 운영 큐이므로 "누가 언제 처리했는지" 기록을 남길 수 있어야 한다.
-- ============================================================================

create table if not exists public.membership_review_actions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  student_membership_id uuid not null references public.student_memberships(id),
  booking_id uuid references public.bookings(id),
  action text not null check (action in ('ACKNOWLEDGED','CONTACTED','RESOLVED','DISMISSED')),
  note text,
  handled_by uuid references public.users(id),
  handled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists membership_review_actions_academy_idx
  on public.membership_review_actions (academy_id, handled_at desc);
create index if not exists membership_review_actions_sm_idx
  on public.membership_review_actions (student_membership_id);
create unique index if not exists membership_review_actions_open_uniq
  on public.membership_review_actions (student_membership_id, coalesce(booking_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where action in ('RESOLVED','DISMISSED');

alter table public.membership_review_actions enable row level security;

drop policy if exists membership_review_actions_staff_select on public.membership_review_actions;
create policy membership_review_actions_staff_select
  on public.membership_review_actions for select
  using (public.is_academy_staff(academy_id) or public.is_super_admin());

drop policy if exists membership_review_actions_staff_insert on public.membership_review_actions;
create policy membership_review_actions_staff_insert
  on public.membership_review_actions for insert
  with check (public.is_academy_staff(academy_id) or public.is_super_admin());

-- 큐 조회 (스태프 전용)
create or replace function public.membership_expiry_review_queue(
  p_academy_id uuid,
  p_include_handled boolean default false
) returns table (
  student_membership_id uuid,
  user_id uuid,
  student_name text,
  membership_id uuid,
  membership_name text,
  membership_end_date date,
  booking_id uuid,
  booking_status text,
  class_id uuid,
  class_title text,
  schedule_id uuid,
  schedule_start_time timestamptz,
  user_ticket_id uuid,
  ticket_name text,
  ticket_expiry_date date,
  last_action text,
  last_handled_at timestamptz,
  last_handled_by uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.membership_assert_staff(p_academy_id);

  return query
  select
    sm.id, sm.user_id, u.name::text, sm.membership_id, m.name, sm.end_date,
    b.id, b.status::text, c.id, c.title::text, s.id, s.start_time,
    ut.id, t.name::text, ut.expiry_date,
    ra.action, ra.handled_at, ra.handled_by
  from public.student_memberships sm
  join public.memberships m on m.id = sm.membership_id
  left join public.users u on u.id = sm.user_id
  join public.classes c on c.audience_membership_id = sm.membership_id
  join public.schedules s on s.class_id = c.id
  join public.bookings b on b.schedule_id = s.id and b.user_id = sm.user_id
  left join public.user_tickets ut on ut.id = b.user_ticket_id
  left join public.tickets t on t.id = ut.ticket_id
  left join lateral (
    select r.action, r.handled_at, r.handled_by
      from public.membership_review_actions r
     where r.student_membership_id = sm.id
       and (r.booking_id is null or r.booking_id = b.id)
     order by r.handled_at desc limit 1
  ) ra on true
  where sm.academy_id = p_academy_id
    and sm.status = 'EXPIRED'
    and s.start_time > now()
    and b.status in ('CONFIRMED', 'PENDING')
    and (p_include_handled or ra.action is null or ra.action not in ('RESOLVED', 'DISMISSED'))
  order by s.start_time asc;
end $$;

revoke all on function public.membership_expiry_review_queue(uuid, boolean) from public, anon, authenticated;
grant execute on function public.membership_expiry_review_queue(uuid, boolean) to authenticated;
;