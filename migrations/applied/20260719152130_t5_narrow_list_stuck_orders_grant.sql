-- 운영 조회는 서버 라우트(assertAcademyAdmin + 서비스 클라이언트)를 통해서만 한다.
-- authenticated 에게 직접 EXECUTE 를 열어 둘 이유가 없다.
revoke execute on function public.list_stuck_orders(uuid, integer) from authenticated;;