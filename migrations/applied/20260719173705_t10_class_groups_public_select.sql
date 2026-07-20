-- T10: 학생 시간표는 수업의 **그룹 이름**과 **특별수업 여부**를 보여줘야 한다
-- (특별수업은 올패스로 덮이지 않고 별도 결제가 필요하다는 사실을 학생이 알아야 하므로).
-- 지금까지 class_groups 는 스태프 전용이라 학생 화면에서 그룹이 항상 null 이었다.
-- 그룹명·is_special 은 민감정보가 아니고 예약 판단에 필수인 공개 사실이므로 읽기를 연다.
-- 쓰기는 기존 class_groups_all_staff 그대로 스태프 전용이다.
create policy class_groups_select_public on public.class_groups
for select
to anon, authenticated
using (true);;