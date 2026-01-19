현재 구현해야할 「마스터(Master) - 인스턴스(Instance)」 아키텍처를 기반으로, 복잡한 수강 권한(Membership)과 결제 우선순위(Priority) 로직이 결합된 형태입니다.요청하신 항목별(수강권, 클래스 생성, 날짜 생성) 상세 정의와 기능, 그리고 이를 이해하기 쉬운 SQL 구조로 설명해 드립니다.1. 🎟️ 수강권(Product) 시스템 시뮬레이션단순히 '쿠폰 몇 개'가 아니라, **'어떤 수업을 들을 수 있는 권한인가'**를 정의하는 시스템입니다.A. 정의 및 기능상품(Product): 학원이 판매하는 수강권의 원본 정의입니다. (예: 1회권, KPOP반 1개월권)그룹(Group) 태그: 수강권이 어떤 수업 카테고리에 적용되는지 연결고리 역할을 합니다.general: 모든 수업(쿠폰 허용 수업)에 사용 가능.group_kpop_basic: 오직 'KPOP 기초반' 그룹이 태깅된 수업에만 적용 (우선순위 높음).유저 지갑(User Wallet): 유저가 구매하여 보유 중인 실제 수강권 목록입니다.B. 코드 구현 로직 (TICKET_PRODUCTS & UserWallet)현재 코드는 TICKET_PRODUCTS 상수 배열을 사용하여 DB의 상품 테이블을 시뮬레이션하고 있습니다.기간제(Period): 횟수 차감 없이 유효기간 내 무제한 수강 (예: 입시반, 정규반 월권).횟수제(Count): 사용할 때마다 1회씩 차감 (예: 일반 쿠폰).C. SQL 구조 (개념적 스키마)product_master (상품 정의 테이블)| id | name | type | access_group | price || :--- | :--- | :--- | :--- | :--- || prod_coupon | 일반 1회용 쿠폰 | count | general | 30,000 || prod_kpop_basic | KPOP 기초반 전용권 | period | group_kpop_basic | 150,000 || prod_entrance | 입시반 멤버십 | period | group_entrance | 500,000 |user_tickets (유저 보유 수강권 테이블)| id | user_id | product_id | type | remaining_count | valid_until || :--- | :--- | :--- | :--- | :--- | :--- || t_01 | user_A | prod_kpop_basic | period | NULL | 2026-02-01 || t_02 | user_A | prod_coupon | count | 5 | 2026-06-30 |2. 📅 클래스 및 날짜 생성 시뮬레이션 (반복 주기 포함)관리자가 규칙(Rule)을 입력하면, 시스템이 달력에 실제 수업(Session)을 뿌려주는 과정입니다.A. 정의 및 기능반복 주기(Recurrence Interval): 단순히 '매주'가 아니라 '격주(2주)', '3주' 간격으로 수업을 생성하는 핵심 로직입니다.접근 제어(Access Config): 수업 생성 시, 이 수업을 **'누가 들을 수 있는지'**와 **'일반 쿠폰을 받아줄지'**를 설정합니다.B. 코드 구현 로직 (generateSessionDates)가장 중요한 날짜 생성 알고리즘은 다음과 같습니다.시작일 기준 주차 계산: 시작 날짜(Start Date)를 0주 차로 잡습니다.Modulo 연산: (현재 주차) % (반복 주기) == 0 인 주에만 수업을 생성합니다.예: 2주 간격 설정 시 -> 0주차(생성), 1주차(건너뜀), 2주차(생성), 3주차(건너뜀)...요일 필터링: 해당 주차 내에서도 선택된 요일(예: 수, 금)에 해당하는 날짜만 최종 추출합니다.C. SQL 구조 (개념적 스키마)sessions (생성된 실제 수업 테이블)이 테이블의 데이터가 달력에 표시됩니다. access_config는 보통 JSON 형태로 저장하여 유연성을 확보합니다.idcourse_namedatestart_timeinstructoraccess_config (JSON)s_101KPOP 기초반2026-01-1418:20WOOTAE{"requiredGroup": "group_kpop_basic", "allowStandardCoupon": true}s_102입시반2026-01-1617:00ZIYU{"requiredGroup": "group_entrance", "allowStandardCoupon": false}3. 💳 수강 신청 및 차감 우선순위 로직유저가 [신청하기] 버튼을 눌렀을 때, 시스템이 어떤 수강권을 사용할지 결정하는 로직입니다. (현재 checkAccessStatus 함수에 구현됨)A. 로직 흐름 (Algorithm)Step 1. 전용 수강권 확인 (Priority 1 - Membership)수업의 accessConfig.requiredGroup 값을 확인합니다. (예: group_kpop_basic)유저 지갑(user_tickets)에 해당 그룹과 매칭되는 유효한 티켓이 있는지 조회합니다.있다면: ✅ 무료 통과 (쿠폰 차감 안 함). 결제 수단: membership.Step 2. 일반 쿠폰 허용 여부 확인 (Priority 2 - Coupon)전용 수강권이 없다면, 수업의 accessConfig.allowStandardCoupon이 true인지 확인합니다.true라면 유저 지갑에 type='count'인 티켓(일반 쿠폰)이 있는지 확인합니다.있다면: ✅ 쿠폰 1회 차감. 결제 수단: coupon.Step 3. 거절 (Deny)위 조건에 모두 해당하지 않으면 신청을 막고, 필요한 수강권 정보를 안내합니다.B. SQL 시뮬레이션 (수강 신청 시 발생하는 트랜잭션)SQL-- 1. 유저가 's_101(KPOP 기초반)' 신청 시도

-- [Check 1] 전용 수강권 보유 여부 확인
SELECT * FROM user_tickets 
WHERE user_id = 'user_A' 
  AND product_id IN (SELECT id FROM product_master WHERE access_group = 'group_kpop_basic')
  AND valid_until >= CURDATE();

-- [Result] 존재하면 -> INSERT booking (method='membership')

-- [Check 2] (전용권 없을 시) 일반 쿠폰 확인
-- 수업 설정에서 allow_standard_coupon = TRUE 인지 먼저 확인 후
SELECT * FROM user_tickets 
WHERE user_id = 'user_A' 
  AND type = 'count' 
  AND remaining_count > 0;

-- [Result] 존재하면 -> 
-- 1. UPDATE user_tickets SET remaining_count = remaining_count - 1 WHERE id = '...'
-- 2. INSERT INTO bookings (user_id, session_id, used_method) VALUES ('user_A', 's_101', 'coupon');
요약현재 시스템은 단순한 예약 시스템을 넘어, **학원의 복잡한 수익 모델(회원권 vs 쿠폰)**을 정확하게 반영하도록 설계되었습니다.관리자: 반복 주기와 접근 권한(누가 들을 수 있는지)을 설정하여 수업을 만듭니다.시스템: 설정된 규칙에 따라 달력에 수업을 배치합니다.수강생: 시스템이 자동으로 '가장 유리한 수강권(전용 회원권)'을 우선 적용하고, 없을 때만 쿠폰을 차감합니다.