-- T10: 대상 한정(멤버십 전용) 수업은 "아무에게도 안 보임"이 아니라
-- "그 멤버십을 가진 학생에게는 보여야" 한다.
-- 기존 정책은 스태프 외 전원에게 숨겨서, 정작 자격 있는 회원도 시간표에서 볼 수 없었다.
-- 숨김의 정본은 계속 RLS 다 (클라이언트 필터링 금지).

drop policy if exists classes_select_public on public.classes;
create policy classes_select_public on public.classes
for select
using (
  audience_membership_id is null
  or public.is_academy_staff(academy_id)
  or public.is_super_admin()
  or (
    auth.uid() is not null
    and public.has_active_membership(auth.uid(), audience_membership_id, public.kst_date(now()))
  )
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
         or (
           auth.uid() is not null
           and public.has_active_membership(auth.uid(), c.audience_membership_id, public.kst_date(now()))
         )
       )
  )
);;