-- 피드백 스튜디오 실제 수업 정보 INSERT
-- 2026년 1월 스케줄 기준

-- 기존 데이터 참조
-- Academy ID: '6e67aada-8e2e-48ce-b5ac-e725f51d770f'
-- Branch ID: '11a2a888-0c70-4645-8b5c-24f37a153e99'

-- ============================================
-- 1. 강사(Instructors) INSERT
-- ============================================
INSERT INTO "public"."instructors" ("id", "name_en", "name_kr", "created_at") VALUES
(gen_random_uuid(), 'JUNAH', '주나', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'YLYN', '와일린', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JIKANG', '지강', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MYEONGHEE', '명희', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MOOREUPSTAGE', '무릅스테이지', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ROODY', '루디', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HEEEUN', '희은', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HUI', '휴', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'YUMI', '유미', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MANGO', '망고', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JUHASTAGE', '주하스테이지', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CELINE', '셀린', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SOYEON', '소연', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HEESOO', '희수', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'COBALTBLUE', '코발트블루', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BERA', '베라', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BIBI', '비비', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JUNGMIN', '정민', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HWI', '휘', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BETTY', '베티', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CHAEKIT', '채킷', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MINJUN', '민준', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JIMIN', '지민', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ZIGU', '지구', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'FOXY', '폭시', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HOSANG', '호상', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HASH', '해시', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TEMA', '테마', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HOUSETAEK', '하우스택', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JENN', '젠', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TAEDONG', '태동', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'UDEE', '우디', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SOLLE', '솔레', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TARZAN', '타잔', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'EIFFEL', '에펠', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JAEGU', '재구', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BEOM', '범', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'EVAN', '에반', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TAMA', '타마', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SUNJ', '선지', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ONNY', '온니', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PABAPARK', '파바파크', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ALLK', '올케이', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JUNGYU', '정유', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CENTIMETER', '센티미터', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HYERION', '혜리온', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'OFFLOO', '오프루', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JAHYO', '자효', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MUALN', '무알엔', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BINNN', '빈', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'NAIN', '나인', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CANDANCE', '캔댄스', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PAULINE', '폴린', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SAMJAVI', '삼자비', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'VIDA', '비다', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'KALVIN', '칼빈', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SAMUEL', '사무엘', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CHAEWON', '채원', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JENNI', '제니', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JIMMY', '지미', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JUNE', '준', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'DAYEON', '다연', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ALMOND', '아몬드', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PUNCH', '펀치', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SEUNGCHOEL', '승철', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'KENSI', '켄시', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JUNGWOO', '정우', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TAERIN', '태린', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'YUNHWAN', '윤환', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MINSEO', '민서', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'KXXO', '케이엑스엑스오', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HYERICA', '혜리카', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ROOT', '루트', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CHADI', '차디', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JOOHEE', '주희', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SEUNGMIN', '승민', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MULAN', '뮬란', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MINZOO', '민주', CURRENT_TIMESTAMP);

-- ============================================
-- 2. 강의실(Halls) INSERT
-- ============================================
INSERT INTO "public"."halls" ("id", "branch_id", "name", "capacity", "floor_info") VALUES
(gen_random_uuid(), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, '메인 스튜디오', 30, '3층'),
(gen_random_uuid(), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, '스튜디오 A', 25, '3층'),
(gen_random_uuid(), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, '스튜디오 B', 25, '3층');

-- ============================================
-- 3. 수업(Classes) INSERT
-- ============================================
INSERT INTO "public"."classes" ("id", "academy_id", "title", "description", "difficulty_level", "genre", "class_type", "price", "instructor_id", "created_at") VALUES
-- 정규 수업
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, '전문반', '전문 댄서를 위한 고급 수업', 'ADVANCED', 'ALL', 'REGULAR', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, '키즈전문반', '어린이를 위한 전문 댄스 수업', 'BEGINNER', 'ALL', 'REGULAR', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, '전문반(프리)', '프리스타일 전문반', 'ADVANCED', 'FREESTYLE', 'REGULAR', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, '전문반(왁킹)', '왁킹 전문반', 'ADVANCED', 'WACKING', 'REGULAR', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, '토요베이직반', '토요일 기본 수업', 'BEGINNER', 'ALL', 'REGULAR', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, '키즈 비기너', '어린이 초급 수업', 'BEGINNER', 'ALL', 'REGULAR', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, 'CHAEKIT전문반', 'CHAEKIT 강사의 전문반', 'ADVANCED', 'ALL', 'REGULAR', 0, (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1), CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, 'WORKSHOP', '특별 워크샵', 'ALL', 'ALL', 'WORKSHOP', 0, NULL, CURRENT_TIMESTAMP),
(gen_random_uuid(), '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid, 'HASH트레이닝', 'HASH 강사의 트레이닝', 'INTERMEDIATE', 'ALL', 'TRAINING', 0, (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1), CURRENT_TIMESTAMP);

-- 개별 강사 수업들 (각 강사별로 클래스 생성)
INSERT INTO "public"."classes" ("id", "academy_id", "title", "description", "difficulty_level", "genre", "class_type", "price", "instructor_id", "created_at")
SELECT 
  gen_random_uuid(),
  '6e67aada-8e2e-48ce-b5ac-e725f51d770f'::uuid,
  COALESCE(i.name_kr, i.name_en) || ' 수업',
  COALESCE(i.name_kr, i.name_en) || ' 강사의 개인 수업',
  'INTERMEDIATE',
  'ALL',
  'REGULAR',
  0,
  i.id,
  CURRENT_TIMESTAMP
FROM "public"."instructors" i;

-- ============================================
-- 4. 스케줄(Schedules) INSERT
-- ============================================
-- 2026년 1월 스케줄 데이터
-- 시간대는 KST 기준으로 작성 (UTC+9)
-- 강사는 이름으로 조회하여 UUID를 가져옵니다

-- 1월 2일 (목요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '키즈전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1),
  '2026-01-02 18:00:00+09'::timestamptz,
  '2026-01-02 19:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1),
  '2026-01-02 18:20:00+09'::timestamptz,
  '2026-01-02 19:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1),
  '2026-01-02 19:20:00+09'::timestamptz,
  '2026-01-02 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1),
  '2026-01-02 19:20:00+09'::timestamptz,
  '2026-01-02 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MULAN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'MULAN' LIMIT 1),
  '2026-01-02 19:20:00+09'::timestamptz,
  '2026-01-02 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1),
  '2026-01-02 20:40:00+09'::timestamptz,
  '2026-01-02 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1),
  '2026-01-02 20:40:00+09'::timestamptz,
  '2026-01-02 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1),
  '2026-01-02 20:40:00+09'::timestamptz,
  '2026-01-02 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 3일 (금요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SEUNGMIN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'SEUNGMIN' LIMIT 1),
  '2026-01-03 18:30:00+09'::timestamptz,
  '2026-01-03 19:30:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1),
  '2026-01-03 20:00:00+09'::timestamptz,
  '2026-01-03 21:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 5일 (일요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1),
  '2026-01-05 18:20:00+09'::timestamptz,
  '2026-01-05 19:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HUI' LIMIT 1),
  '2026-01-05 18:20:00+09'::timestamptz,
  '2026-01-05 19:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1),
  '2026-01-05 19:20:00+09'::timestamptz,
  '2026-01-05 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HUI' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HUI' LIMIT 1),
  '2026-01-05 19:20:00+09'::timestamptz,
  '2026-01-05 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YUMI' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'YUMI' LIMIT 1),
  '2026-01-05 20:40:00+09'::timestamptz,
  '2026-01-05 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MANGO' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'MANGO' LIMIT 1),
  '2026-01-05 20:40:00+09'::timestamptz,
  '2026-01-05 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1),
  '2026-01-05 20:40:00+09'::timestamptz,
  '2026-01-05 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 6일 (월요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1),
  '2026-01-06 18:00:00+09'::timestamptz,
  '2026-01-06 19:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1),
  '2026-01-06 18:30:00+09'::timestamptz,
  '2026-01-06 19:30:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HEESOO' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HEESOO' LIMIT 1),
  '2026-01-06 18:30:00+09'::timestamptz,
  '2026-01-06 19:30:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1),
  '2026-01-06 19:50:00+09'::timestamptz,
  '2026-01-06 20:50:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1),
  '2026-01-06 19:20:00+09'::timestamptz,
  '2026-01-06 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BIBI' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'BIBI' LIMIT 1),
  '2026-01-06 20:40:00+09'::timestamptz,
  '2026-01-06 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1),
  '2026-01-06 21:10:00+09'::timestamptz,
  '2026-01-06 22:10:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HWI' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HWI' LIMIT 1),
  '2026-01-06 21:10:00+09'::timestamptz,
  '2026-01-06 22:10:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 7일 (화요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1),
  '2026-01-07 18:00:00+09'::timestamptz,
  '2026-01-07 19:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = 'CHAEKIT전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1),
  '2026-01-07 18:00:00+09'::timestamptz,
  '2026-01-07 19:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1),
  '2026-01-07 18:30:00+09'::timestamptz,
  '2026-01-07 19:30:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JIMIN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JIMIN' LIMIT 1),
  '2026-01-07 19:20:00+09'::timestamptz,
  '2026-01-07 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ZIGU' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'ZIGU' LIMIT 1),
  '2026-01-07 19:50:00+09'::timestamptz,
  '2026-01-07 20:50:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1),
  '2026-01-07 19:50:00+09'::timestamptz,
  '2026-01-07 20:50:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1),
  '2026-01-07 21:10:00+09'::timestamptz,
  '2026-01-07 22:10:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1),
  '2026-01-07 21:10:00+09'::timestamptz,
  '2026-01-07 22:10:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 8일 (수요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1),
  '2026-01-08 18:00:00+09'::timestamptz,
  '2026-01-08 19:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1),
  '2026-01-08 18:20:00+09'::timestamptz,
  '2026-01-08 19:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JENN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JENN' LIMIT 1),
  '2026-01-08 18:30:00+09'::timestamptz,
  '2026-01-08 19:30:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TAEDONG' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'TAEDONG' LIMIT 1),
  '2026-01-08 18:30:00+09'::timestamptz,
  '2026-01-08 19:30:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1),
  '2026-01-08 19:20:00+09'::timestamptz,
  '2026-01-08 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SOLLE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'SOLLE' LIMIT 1),
  '2026-01-08 19:20:00+09'::timestamptz,
  '2026-01-08 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반(프리)' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1),
  '2026-01-08 20:40:00+09'::timestamptz,
  '2026-01-08 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반(왁킹)' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1),
  '2026-01-08 20:40:00+09'::timestamptz,
  '2026-01-08 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 9일 (목요일) - 이미 추가됨, 패턴 확인용으로 주석 처리
-- 1월 10일 (금요일) - 이미 추가됨
-- 1월 11일 (토요일) - 이미 추가됨

-- 1월 12일 (일요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = 'HASH트레이닝' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1),
  '2026-01-12 14:00:00+09'::timestamptz,
  '2026-01-12 16:00:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1),
  '2026-01-12 18:20:00+09'::timestamptz,
  '2026-01-12 19:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE title = '전문반' LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1),
  '2026-01-12 18:20:00+09'::timestamptz,
  '2026-01-12 19:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1),
  '2026-01-12 19:20:00+09'::timestamptz,
  '2026-01-12 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1),
  '2026-01-12 19:20:00+09'::timestamptz,
  '2026-01-12 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SUNJ' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'SUNJ' LIMIT 1),
  '2026-01-12 19:20:00+09'::timestamptz,
  '2026-01-12 20:20:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YUMI' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'YUMI' LIMIT 1),
  '2026-01-12 20:40:00+09'::timestamptz,
  '2026-01-12 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ONNY' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'ONNY' LIMIT 1),
  '2026-01-12 20:40:00+09'::timestamptz,
  '2026-01-12 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT 
  gen_random_uuid(),
  (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1) LIMIT 1),
  '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid,
  (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1),
  (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1),
  '2026-01-12 20:40:00+09'::timestamptz,
  '2026-01-12 21:40:00+09'::timestamptz,
  20, 0, false, CURRENT_TIMESTAMP;

-- 1월 13일 (월요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1), '2026-01-13 18:00:00+09'::timestamptz, '2026-01-13 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1), '2026-01-13 18:30:00+09'::timestamptz, '2026-01-13 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'PABAPARK' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'PABAPARK' LIMIT 1), '2026-01-13 18:30:00+09'::timestamptz, '2026-01-13 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1), '2026-01-13 19:50:00+09'::timestamptz, '2026-01-13 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1), '2026-01-13 19:20:00+09'::timestamptz, '2026-01-13 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ALLK' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ALLK' LIMIT 1), '2026-01-13 19:20:00+09'::timestamptz, '2026-01-13 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1), '2026-01-13 20:40:00+09'::timestamptz, '2026-01-13 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNGYU' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNGYU' LIMIT 1), '2026-01-13 20:40:00+09'::timestamptz, '2026-01-13 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CENTIMETER' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CENTIMETER' LIMIT 1), '2026-01-13 21:10:00+09'::timestamptz, '2026-01-13 22:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 14일 (화요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1), '2026-01-14 16:10:00+09'::timestamptz, '2026-01-14 17:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1), '2026-01-14 18:00:00+09'::timestamptz, '2026-01-14 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'CHAEKIT전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1), '2026-01-14 18:00:00+09'::timestamptz, '2026-01-14 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1), '2026-01-14 18:30:00+09'::timestamptz, '2026-01-14 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HYERION' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HYERION' LIMIT 1), '2026-01-14 19:50:00+09'::timestamptz, '2026-01-14 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'OFFLOO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'OFFLOO' LIMIT 1), '2026-01-14 19:50:00+09'::timestamptz, '2026-01-14 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1), '2026-01-14 19:50:00+09'::timestamptz, '2026-01-14 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1), '2026-01-14 21:10:00+09'::timestamptz, '2026-01-14 22:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MINZOO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MINZOO' LIMIT 1), '2026-01-14 21:10:00+09'::timestamptz, '2026-01-14 22:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 15일 (수요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1), '2026-01-15 18:00:00+09'::timestamptz, '2026-01-15 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1), '2026-01-15 18:20:00+09'::timestamptz, '2026-01-15 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JAHYO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JAHYO' LIMIT 1), '2026-01-15 18:30:00+09'::timestamptz, '2026-01-15 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1), '2026-01-15 19:20:00+09'::timestamptz, '2026-01-15 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MUALN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MUALN' LIMIT 1), '2026-01-15 19:20:00+09'::timestamptz, '2026-01-15 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BINNN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BINNN' LIMIT 1), '2026-01-15 19:20:00+09'::timestamptz, '2026-01-15 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반(프리)' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-15 20:40:00+09'::timestamptz, '2026-01-15 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반(왁킹)' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-15 20:40:00+09'::timestamptz, '2026-01-15 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 16일 (목요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '키즈전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-16 18:00:00+09'::timestamptz, '2026-01-16 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-16 18:20:00+09'::timestamptz, '2026-01-16 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-16 19:20:00+09'::timestamptz, '2026-01-16 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1), '2026-01-16 19:20:00+09'::timestamptz, '2026-01-16 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'NAIN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'NAIN' LIMIT 1), '2026-01-16 19:20:00+09'::timestamptz, '2026-01-16 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1), '2026-01-16 20:40:00+09'::timestamptz, '2026-01-16 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1), '2026-01-16 20:40:00+09'::timestamptz, '2026-01-16 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1), '2026-01-16 20:40:00+09'::timestamptz, '2026-01-16 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 17일 (금요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '토요베이직반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-17 14:00:00+09'::timestamptz, '2026-01-17 15:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1), '2026-01-17 20:00:00+09'::timestamptz, '2026-01-17 21:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1), '2026-01-17 16:10:00+09'::timestamptz, '2026-01-17 17:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1), '2026-01-17 18:30:00+09'::timestamptz, '2026-01-17 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'PAULINE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'PAULINE' LIMIT 1), '2026-01-17 20:30:00+09'::timestamptz, '2026-01-17 21:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 18일 (토요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'WORKSHOP' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-18 14:00:00+09'::timestamptz, '2026-01-18 16:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1), '2026-01-18 16:10:00+09'::timestamptz, '2026-01-18 17:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CANDANCE' LIMIT 1), '2026-01-18 18:30:00+09'::timestamptz, '2026-01-18 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SAMJAVI' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SAMJAVI' LIMIT 1), '2026-01-18 20:30:00+09'::timestamptz, '2026-01-18 21:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 19일 (일요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'HASH트레이닝' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1), '2026-01-19 14:00:00+09'::timestamptz, '2026-01-19 16:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1), '2026-01-19 18:20:00+09'::timestamptz, '2026-01-19 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1), '2026-01-19 18:20:00+09'::timestamptz, '2026-01-19 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1), '2026-01-19 19:20:00+09'::timestamptz, '2026-01-19 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1), '2026-01-19 19:20:00+09'::timestamptz, '2026-01-19 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'VIDA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'VIDA' LIMIT 1), '2026-01-19 19:20:00+09'::timestamptz, '2026-01-19 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'KALVIN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'KALVIN' LIMIT 1), '2026-01-19 20:40:00+09'::timestamptz, '2026-01-19 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1), '2026-01-19 20:40:00+09'::timestamptz, '2026-01-19 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'PAULINE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'PAULINE' LIMIT 1), '2026-01-19 20:50:00+09'::timestamptz, '2026-01-19 21:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 20일 (월요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '키즈 비기너' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-20 17:00:00+09'::timestamptz, '2026-01-20 18:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1), '2026-01-20 18:00:00+09'::timestamptz, '2026-01-20 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1), '2026-01-20 18:30:00+09'::timestamptz, '2026-01-20 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1), '2026-01-20 19:50:00+09'::timestamptz, '2026-01-20 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1), '2026-01-20 19:20:00+09'::timestamptz, '2026-01-20 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1), '2026-01-20 20:40:00+09'::timestamptz, '2026-01-20 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'WORKSHOP' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-20 19:00:00+09'::timestamptz, '2026-01-20 21:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SAMUEL' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SAMUEL' LIMIT 1), '2026-01-20 19:00:00+09'::timestamptz, '2026-01-20 20:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SAMJAVI' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SAMJAVI' LIMIT 1), '2026-01-20 20:50:00+09'::timestamptz, '2026-01-20 21:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 21일 (화요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1), '2026-01-21 18:00:00+09'::timestamptz, '2026-01-21 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'CHAEKIT전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1), '2026-01-21 18:00:00+09'::timestamptz, '2026-01-21 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1), '2026-01-21 18:30:00+09'::timestamptz, '2026-01-21 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CHAEWON' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CHAEWON' LIMIT 1), '2026-01-21 18:30:00+09'::timestamptz, '2026-01-21 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1), '2026-01-21 19:50:00+09'::timestamptz, '2026-01-21 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1), '2026-01-21 19:50:00+09'::timestamptz, '2026-01-21 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1), '2026-01-21 19:50:00+09'::timestamptz, '2026-01-21 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SAMUEL' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SAMUEL' LIMIT 1), '2026-01-21 16:10:00+09'::timestamptz, '2026-01-21 17:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SAMUEL' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SAMUEL' LIMIT 1), '2026-01-21 21:10:00+09'::timestamptz, '2026-01-21 22:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 22일 (수요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1), '2026-01-22 18:00:00+09'::timestamptz, '2026-01-22 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1), '2026-01-22 18:20:00+09'::timestamptz, '2026-01-22 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JENNI' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JENNI' LIMIT 1), '2026-01-22 18:30:00+09'::timestamptz, '2026-01-22 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1), '2026-01-22 19:20:00+09'::timestamptz, '2026-01-22 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MUALN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MUALN' LIMIT 1), '2026-01-22 19:20:00+09'::timestamptz, '2026-01-22 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JIMMY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JIMMY' LIMIT 1), '2026-01-22 19:20:00+09'::timestamptz, '2026-01-22 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반(프리)' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-22 20:40:00+09'::timestamptz, '2026-01-22 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반(왁킹)' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-22 20:40:00+09'::timestamptz, '2026-01-22 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 23일 (목요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '키즈전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-23 18:00:00+09'::timestamptz, '2026-01-23 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-23 18:20:00+09'::timestamptz, '2026-01-23 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-23 19:20:00+09'::timestamptz, '2026-01-23 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1), '2026-01-23 19:20:00+09'::timestamptz, '2026-01-23 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNE' LIMIT 1), '2026-01-23 19:20:00+09'::timestamptz, '2026-01-23 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1), '2026-01-23 20:40:00+09'::timestamptz, '2026-01-23 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1), '2026-01-23 20:40:00+09'::timestamptz, '2026-01-23 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1), '2026-01-23 20:40:00+09'::timestamptz, '2026-01-23 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 24일 (금요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '토요베이직반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-24 14:00:00+09'::timestamptz, '2026-01-24 15:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'DAYEON' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'DAYEON' LIMIT 1), '2026-01-24 17:00:00+09'::timestamptz, '2026-01-24 18:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ALMOND' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ALMOND' LIMIT 1), '2026-01-24 18:30:00+09'::timestamptz, '2026-01-24 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JAEGU' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JAEGU' LIMIT 1), '2026-01-24 18:30:00+09'::timestamptz, '2026-01-24 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1), '2026-01-24 20:00:00+09'::timestamptz, '2026-01-24 21:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'PUNCH' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'PUNCH' LIMIT 1), '2026-01-24 20:00:00+09'::timestamptz, '2026-01-24 21:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 25일 (토요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'WORKSHOP' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-25 14:00:00+09'::timestamptz, '2026-01-25 16:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 26일 (일요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'HASH트레이닝' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HASH' LIMIT 1), '2026-01-26 14:00:00+09'::timestamptz, '2026-01-26 16:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1), '2026-01-26 18:20:00+09'::timestamptz, '2026-01-26 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1), '2026-01-26 18:20:00+09'::timestamptz, '2026-01-26 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TAMA' LIMIT 1), '2026-01-26 19:20:00+09'::timestamptz, '2026-01-26 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HEEEUN' LIMIT 1), '2026-01-26 19:20:00+09'::timestamptz, '2026-01-26 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SEUNGCHOEL' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SEUNGCHOEL' LIMIT 1), '2026-01-26 19:20:00+09'::timestamptz, '2026-01-26 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YUMI' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'YUMI' LIMIT 1), '2026-01-26 20:40:00+09'::timestamptz, '2026-01-26 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'KENSI' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'KENSI' LIMIT 1), '2026-01-26 20:40:00+09'::timestamptz, '2026-01-26 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUHASTAGE' LIMIT 1), '2026-01-26 20:40:00+09'::timestamptz, '2026-01-26 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 27일 (월요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '키즈 비기너' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-27 17:00:00+09'::timestamptz, '2026-01-27 18:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CELINE' LIMIT 1), '2026-01-27 18:00:00+09'::timestamptz, '2026-01-27 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'SOYEON' LIMIT 1), '2026-01-27 18:30:00+09'::timestamptz, '2026-01-27 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNGWOO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNGWOO' LIMIT 1), '2026-01-27 18:30:00+09'::timestamptz, '2026-01-27 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'COBALTBLUE' LIMIT 1), '2026-01-27 19:50:00+09'::timestamptz, '2026-01-27 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BERA' LIMIT 1), '2026-01-27 19:20:00+09'::timestamptz, '2026-01-27 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ALLK' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ALLK' LIMIT 1), '2026-01-27 19:20:00+09'::timestamptz, '2026-01-27 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNGMIN' LIMIT 1), '2026-01-27 20:40:00+09'::timestamptz, '2026-01-27 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TAERIN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TAERIN' LIMIT 1), '2026-01-27 20:40:00+09'::timestamptz, '2026-01-27 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 28일 (화요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YUNHWAN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'YUNHWAN' LIMIT 1), '2026-01-28 16:10:00+09'::timestamptz, '2026-01-28 17:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'BETTY' LIMIT 1), '2026-01-28 18:00:00+09'::timestamptz, '2026-01-28 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = 'CHAEKIT전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CHAEKIT' LIMIT 1), '2026-01-28 18:00:00+09'::timestamptz, '2026-01-28 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MINJUN' LIMIT 1), '2026-01-28 18:30:00+09'::timestamptz, '2026-01-28 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ZIGU' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ZIGU' LIMIT 1), '2026-01-28 19:50:00+09'::timestamptz, '2026-01-28 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'OFFLOO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'OFFLOO' LIMIT 1), '2026-01-28 19:50:00+09'::timestamptz, '2026-01-28 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'FOXY' LIMIT 1), '2026-01-28 19:50:00+09'::timestamptz, '2026-01-28 20:50:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HOSANG' LIMIT 1), '2026-01-28 21:10:00+09'::timestamptz, '2026-01-28 22:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MINSEO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MINSEO' LIMIT 1), '2026-01-28 21:10:00+09'::timestamptz, '2026-01-28 22:10:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 29일 (수요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'TEMA' LIMIT 1), '2026-01-29 18:00:00+09'::timestamptz, '2026-01-29 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HOUSETAEK' LIMIT 1), '2026-01-29 18:20:00+09'::timestamptz, '2026-01-29 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'KXXO' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'KXXO' LIMIT 1), '2026-01-29 18:30:00+09'::timestamptz, '2026-01-29 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'UDEE' LIMIT 1), '2026-01-29 19:20:00+09'::timestamptz, '2026-01-29 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MUALN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MUALN' LIMIT 1), '2026-01-29 19:20:00+09'::timestamptz, '2026-01-29 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'HYERICA' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'HYERICA' LIMIT 1), '2026-01-29 19:20:00+09'::timestamptz, '2026-01-29 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ROOT' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ROOT' LIMIT 1), '2026-01-29 20:40:00+09'::timestamptz, '2026-01-29 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 30일 (목요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '키즈전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-30 18:00:00+09'::timestamptz, '2026-01-30 19:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '전문반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-30 18:20:00+09'::timestamptz, '2026-01-30 19:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-30 19:20:00+09'::timestamptz, '2026-01-30 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'YLYN' LIMIT 1), '2026-01-30 19:20:00+09'::timestamptz, '2026-01-30 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'CHADI' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'CHADI' LIMIT 1), '2026-01-30 19:20:00+09'::timestamptz, '2026-01-30 20:20:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JIKANG' LIMIT 1), '2026-01-30 20:40:00+09'::timestamptz, '2026-01-30 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MYEONGHEE' LIMIT 1), '2026-01-30 20:40:00+09'::timestamptz, '2026-01-30 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 B' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'MOOREUPSTAGE' LIMIT 1), '2026-01-30 20:40:00+09'::timestamptz, '2026-01-30 21:40:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 1월 31일 (금요일)
INSERT INTO "public"."schedules" ("id", "class_id", "branch_id", "hall_id", "instructor_id", "start_time", "end_time", "max_students", "current_students", "is_canceled", "created_at")
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE title = '토요베이직반' LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JUNAH' LIMIT 1), '2026-01-31 14:00:00+09'::timestamptz, '2026-01-31 15:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'JOOHEE' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'JOOHEE' LIMIT 1), '2026-01-31 18:30:00+09'::timestamptz, '2026-01-31 19:30:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '메인 스튜디오' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'ROODY' LIMIT 1), '2026-01-31 20:00:00+09'::timestamptz, '2026-01-31 21:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP
UNION ALL
SELECT gen_random_uuid(), (SELECT id FROM classes WHERE instructor_id = (SELECT id FROM instructors WHERE name_en = 'PUNCH' LIMIT 1) LIMIT 1), '11a2a888-0c70-4645-8b5c-24f37a153e99'::uuid, (SELECT id FROM halls WHERE name = '스튜디오 A' LIMIT 1), (SELECT id FROM instructors WHERE name_en = 'PUNCH' LIMIT 1), '2026-01-31 20:00:00+09'::timestamptz, '2026-01-31 21:00:00+09'::timestamptz, 20, 0, false, CURRENT_TIMESTAMP;

-- 참고사항:
-- 1. 시간은 KST(UTC+9) 기준으로 작성했습니다
-- 2. 수업 시간은 일반적으로 1시간으로 설정했습니다
-- 3. max_students는 기본값 20으로 설정했습니다 (실제 값으로 수정 필요)
-- 4. 강사와 수업은 이름으로 조회하여 UUID를 가져옵니다
-- 5. STAGE 관련 항목은 모두 제거했습니다
-- 6. 같은 시간대의 수업들은 다른 강의실로 분산 배정했습니다
