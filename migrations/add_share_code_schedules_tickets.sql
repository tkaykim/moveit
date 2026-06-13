-- 세션(schedules)·수강권(tickets) 짧은 공유 코드
-- 공유 링크를 /book/{학원slug}/{6자리코드} 형태로 깔끔하게 만들기 위함.
-- 코드는 두 테이블에서 전역 유니크(혼동되는 0,o,1,i,l 제외 31자 알파벳, 6자리).
-- 적용 환경: Supabase moveit (ref vjxnollfggbufpqldxrb). 2026-06-13 적용 완료.

ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS share_code text;
ALTER TABLE public.tickets    ADD COLUMN IF NOT EXISTS share_code text;

CREATE OR REPLACE FUNCTION public.assign_share_code() RETURNS trigger AS $$
DECLARE
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  code text;
  n int;
BEGIN
  IF NEW.share_code IS NOT NULL AND NEW.share_code <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    code := '';
    FOR n IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.schedules WHERE share_code = code)
          AND NOT EXISTS (SELECT 1 FROM public.tickets   WHERE share_code = code);
  END LOOP;
  NEW.share_code := code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_schedules_share_code ON public.schedules;
CREATE TRIGGER trg_schedules_share_code
  BEFORE INSERT ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.assign_share_code();

DROP TRIGGER IF EXISTS trg_tickets_share_code ON public.tickets;
CREATE TRIGGER trg_tickets_share_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_share_code();

-- 기존 행 백필
DO $$
DECLARE
  r record;
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  code text;
  n int;
BEGIN
  FOR r IN SELECT id FROM public.schedules WHERE share_code IS NULL LOOP
    LOOP
      code := '';
      FOR n IN 1..6 LOOP
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.schedules WHERE share_code = code)
            AND NOT EXISTS (SELECT 1 FROM public.tickets   WHERE share_code = code);
    END LOOP;
    UPDATE public.schedules SET share_code = code WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id FROM public.tickets WHERE share_code IS NULL LOOP
    LOOP
      code := '';
      FOR n IN 1..6 LOOP
        code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.schedules WHERE share_code = code)
            AND NOT EXISTS (SELECT 1 FROM public.tickets   WHERE share_code = code);
    END LOOP;
    UPDATE public.tickets SET share_code = code WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_schedules_share_code ON public.schedules (share_code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_share_code   ON public.tickets (share_code);
