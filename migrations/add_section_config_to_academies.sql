-- 학원 상세 페이지 섹션 순서/표시 설정을 위한 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE academies
ADD COLUMN IF NOT EXISTS section_config JSONB DEFAULT NULL;

-- 설명: section_config는 아래와 같은 JSON 구조를 저장합니다.
-- {
--   "tabs": [
--     { "id": "home", "visible": true, "order": 0 },
--     { "id": "schedule", "visible": true, "order": 1 },
--     { "id": "reviews", "visible": true, "order": 2 }
--   ],
--   "homeSections": [
--     { "id": "info", "visible": true, "order": 0 },
--     { "id": "consultation", "visible": true, "order": 1 },
--     { "id": "tags", "visible": true, "order": 2 },
--     { "id": "recent_videos", "visible": true, "order": 3 }
--   ]
-- }
-- 
-- NULL인 경우 기본 순서/표시 설정이 적용됩니다.
