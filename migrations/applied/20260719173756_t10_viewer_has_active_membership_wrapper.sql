-- T10: RLS 안에서 "지금 이 사람이 그 멤버십을 갖고 있나"만 물어보는 래퍼.
--
-- has_active_membership(user, membership, date) 를 anon 에게 직접 열면
-- 아무나 (user_id, membership_id) 를 넣어 남의 멤버십 보유 여부를 캐낼 수 있다.
-- 이 래퍼는 **항상 auth.uid() 만** 본다 — 남을 조회할 방법이 없다.
create or replace function public.viewer_has_active_membership(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when p_membership_id is null then true
    when auth.uid() is null then false
    else public.has_active_membership(auth.uid(), p_membership_id, public.kst_date(now()))
  end;
$$;

revoke all on function public.viewer_has_active_membership(uuid) from public;
grant execute on function public.viewer_has_active_membership(uuid) to anon, authenticated, service_role;

-- 정책을 래퍼로 교체
drop policy if exists classes_select_public on public.classes;
create policy classes_select_public on public.classes
for select
using (
  audience_membership_id is null
  or public.is_academy_staff(academy_id)
  or public.is_super_admin()
  or public.viewer_has_active_membership(audience_membership_id)
);

drop policy if exists schedules_select_public on public.schedules;
create policy schedules_select_public on public.schedules
for select
using (
  exists (
    select 1
      from public.classes c
     where c.id = schedules.class_id
       and (
         c.audience_membership_id is null
         or public.is_academy_staff(c.academy_id)
         or public.is_super_admin()
         or public.viewer_has_active_membership(c.audience_membership_id)
       )
  )
);;