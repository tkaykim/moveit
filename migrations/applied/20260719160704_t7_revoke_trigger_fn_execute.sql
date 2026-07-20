-- 트리거 함수는 트리거가 호출한다. REST /rpc 로 노출될 이유가 없다.
-- (SECURITY DEFINER 함수는 생성 시 PUBLIC 에 EXECUTE 가 자동 부여되므로 명시적으로 회수한다)
revoke all on function public.trg_schedule_canceled_event() from public, anon, authenticated;
;