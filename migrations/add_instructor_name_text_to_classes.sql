-- Applied via Supabase MCP on 2026-05-12
-- Version: 20260512xxxxxx (auto-versioned by Supabase)
-- Purpose: 강사명을 classes 테이블에 텍스트로 직접 저장 (instructors 매핑/JOIN 제거)
--          기존 schedules.instructor_name 컬럼과 동일한 패턴.

alter table public.classes
  add column if not exists instructor_name text;

-- 기존 instructor_id가 세팅된 행의 강사명 백필 (표시 폴백 호환)
update public.classes c
   set instructor_name = coalesce(i.name_kr, i.name_en)
  from public.instructors i
 where c.instructor_id = i.id
   and (c.instructor_name is null or c.instructor_name = '');
