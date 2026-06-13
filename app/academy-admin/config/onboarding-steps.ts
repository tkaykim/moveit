/**
 * 관리자 온보딩 튜토리얼 단계 정의
 *
 * 설계 원칙
 * - 메뉴 나열이 아니라 "학원장이 실제로 밟는 여정" 순서로 안내한다.
 *   (홈 꾸미기 → 수강권 → 수업 → 일정 → 신청관리 → 간편결제 → 홍보)
 * - 사이드바 타겟은 깨지기 쉬운 DOM 인덱스가 아니라 안정적인
 *   data-onboarding="sidebar-<key>" 속성으로 지정한다.
 * - 각 사이드바 스텝은 이동 경로(path/query)와 페이지 키(pageKey)를 스스로 들고 있어,
 *   별도 인덱스 매핑 테이블에 의존하지 않는다.
 */

export type OnboardingPhase = 'welcome' | 'sidebar' | 'page' | 'info' | 'done';

export interface WelcomeStep {
  type: 'welcome';
  target: null;
  title: string;
  body: string;
}

export interface SidebarStep {
  type: 'sidebar';
  /** data-onboarding 속성값 (예: 'sidebar-settings') 또는 'header-quick-pay' */
  target: string;
  label: string;
  message: string;
  /** 이동 후 머무를 페이지 키 (PAGE_STEPS의 키, getPageKeyFromPathname 결과와 일치) */
  pageKey: string;
  /** academyId 뒤에 붙일 경로. 빈 문자열이면 대시보드(루트) */
  path: string;
  /** 선택 쿼리스트링 (예: 'tab=sales') */
  query?: string;
}

/** 하이라이트 대상이 없는 안내 카드(센터 표시). 선택적으로 CTA 버튼 제공 */
export interface InfoStep {
  type: 'info';
  target: null;
  title: string;
  body: string;
  /** CTA 버튼 클릭 시 이동할 경로(academyId 뒤). 없으면 버튼 미표시 */
  ctaPath?: string;
  ctaLabel?: string;
}

export interface PageStepDef {
  target: string;
  title: string;
  body: string;
  /** 이 스텝에서 하이라이트된 요소를 직접 눌러보라고 안내할지 */
  actionHint?: 'click';
  /** 추가 팁 (한 줄) */
  tip?: string;
}

export type GlobalStep = WelcomeStep | SidebarStep | InfoStep;

export const GLOBAL_STEPS: GlobalStep[] = [
  {
    type: 'welcome',
    target: null,
    title: 'MOVE IT 관리자 둘러보기',
    body:
      '학원을 처음 여실 때 밟게 되는 순서대로 안내해 드릴게요.\n' +
      '학원 홈 꾸미기 → 수강권 만들기 → 수업 만들기 → 일정 배치 → 신청 관리 → 간편결제, 그리고 마지막으로 "홍보"까지.\n' +
      '각 단계에서 "이동하기"를 누르면 실제 화면으로 데려다 드립니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-settings',
    label: '① 학원 홈 꾸미기',
    message:
      '가장 먼저 우리 학원 페이지를 채워요.\n' +
      '"이동하기"를 누르면 설정 화면으로 이동합니다.\n' +
      '학원 정보·소개글·대표사진과 페이지 구성을 여기서 꾸밉니다.',
    pageKey: 'settings',
    path: 'settings',
  },
  {
    type: 'sidebar',
    target: 'sidebar-products',
    label: '② 수강권 만들기',
    message:
      '"이동하기"를 누르면 수강권/상품 페이지로 이동합니다.\n' +
      '기간제·횟수제(쿠폰)·워크샵(특강) 수강권과 가격, 할인을 만듭니다.',
    pageKey: 'products',
    path: 'products',
  },
  {
    type: 'sidebar',
    target: 'sidebar-class-masters',
    label: '③ 수업(클래스) 만들기',
    message:
      '"이동하기"를 누르면 클래스(반) 관리 페이지로 이동합니다.\n' +
      '반 이름·장르·난이도·강사를 정하고, 어떤 수강권을 쓸 수 있는지 연결합니다.',
    pageKey: 'class-masters',
    path: 'class-masters',
  },
  {
    type: 'sidebar',
    target: 'sidebar-schedule',
    label: '④ 수업 일정 배치',
    message:
      '"이동하기"를 누르면 스케줄 관리 페이지로 이동합니다.\n' +
      '요일·시간 반복 일정을 등록하면 달력에 수업이 자동으로 채워집니다.',
    pageKey: 'schedule',
    path: 'schedule',
  },
  {
    type: 'sidebar',
    target: 'sidebar-enrollments',
    label: '⑤ 신청인원 관리',
    message:
      '"이동하기"를 누르면 신청인원 관리 페이지로 이동합니다.\n' +
      '수업별 신청자를 보고, 앱으로 신청하지 않은 회원을 수기로 추가할 수 있습니다.',
    pageKey: 'enrollments',
    path: 'enrollments',
  },
  {
    type: 'sidebar',
    target: 'header-quick-pay',
    label: '⑥ 수강권 간편결제',
    message:
      '"이동하기"를 누르면 매출/정산(판매) 화면으로 이동합니다.\n' +
      '학원에 방문한 회원에게 수강권을 즉시 판매·결제할 수 있습니다.',
    pageKey: 'revenue',
    path: 'revenue',
    query: 'tab=sales',
  },
  {
    type: 'info',
    target: null,
    title: '🎉 마지막 — 홍보로 회원 모으기',
    body:
      '수업과 수강권을 만들었다면, 이제 알릴 차례예요.\n' +
      '스케줄에서 세션을 누르면 "결제 링크 복사", 수강권/상품에서는 "구매 링크 복사" 버튼이 있어요.\n' +
      '이 링크를 인스타그램·카카오톡·오픈채팅에 올리면, 회원이 링크만 누르고 바로 결제·신청합니다.\n' +
      '자세한 홍보 방법은 가이드북에서 언제든 다시 볼 수 있어요.',
    ctaPath: 'guide#promote',
    ctaLabel: '홍보 가이드 열기',
  },
];

/** 페이지별 스텝: 실제로 이동·클릭해 보는 요소 중심, 디테일한 설명 */
export const PAGE_STEPS: Record<string, PageStepDef[]> = {
  dashboard: [
    {
      target: 'page-dashboard-setup',
      title: '오픈 준비 체크리스트',
      body: '신규 학원이라면 여기 "학원 오픈 준비" 카드가 가장 먼저 보입니다. 6단계를 차례로 누르면 각 화면으로 이동하고, 실제로 만들면 자동으로 ✓ 체크됩니다. 모두 끝내면 카드는 사라집니다.',
      tip: '각 단계의 완료 여부는 실제 등록 데이터로 판정됩니다.',
    },
    {
      target: 'page-dashboard-0',
      title: '오늘의 수업',
      body: '등록된 스케줄 기준으로 오늘 진행되는 수업 목록이 표시됩니다. 여기서 바로 해당 수업의 신청인원이나 일정을 확인할 수 있습니다.',
    },
    {
      target: 'page-dashboard-1',
      title: '바로가기 카드',
      body: '클래스 관리, 스케줄 관리, 신청인원 관리, 수강권 관리로 한 번에 이동할 수 있는 카드입니다. 각 카드를 클릭해 해당 메뉴로 이동해 보세요.',
      actionHint: 'click',
      tip: '자주 쓰는 메뉴는 대시보드에서 바로 들어가면 편합니다.',
    },
  ],
  settings: [
    {
      target: 'page-settings-0',
      title: '학원 홈 꾸미기',
      body: '여기서 우리 학원 페이지를 꾸밉니다. 위쪽 탭(학원 정보 / 페이지 구성 / 상담)으로 항목을 나눠서 설정할 수 있어요.',
    },
    {
      target: 'page-settings-tab-academy',
      title: '학원 정보',
      body: '학원 이름·주소·연락처·소개글, 인스타그램·유튜브·네이버지도·카카오 채널 링크, 그리고 계좌이체 입금 계좌를 입력합니다. 입력 후 꼭 "저장"을 눌러 주세요.',
      actionHint: 'click',
      tip: '소개글과 대표 링크를 채우면 회원에게 보이는 학원 페이지가 풍성해집니다.',
    },
    {
      target: 'page-settings-tab-page',
      title: '페이지 구성',
      body: '회원에게 보이는 학원 홈 화면의 섹션 순서를 바꾸거나, 보이기/숨기기를 토글하고, 커스텀 섹션(공지·이벤트 등)을 추가할 수 있습니다. 여기를 한 번이라도 저장하면 "홈 꾸미기" 단계가 완료됩니다.',
      actionHint: 'click',
    },
  ],
  'class-masters': [
    {
      target: 'page-class-masters-0',
      title: '클래스(반) 관리 화면',
      body: '클래스(반)는 수업의 기본 단위입니다. 여기서 정의한 클래스를 기준으로 스케줄(세션)을 만들고, 수강권과 연결합니다. 활성/비활성 탭으로 운영 중인 반만 볼 수 있습니다.',
    },
    {
      target: 'page-class-masters-add',
      title: '새 클래스 추가',
      body: '"새 클래스 추가" 버튼을 누르면 반 이름, 장르, 난이도, 강사·강의실, 수강권 허용(정규/팝업/워크샵) 등을 설정하는 모달이 열립니다. 한 번 눌러 보세요.',
      actionHint: 'click',
      tip: '반을 먼저 만든 뒤, 스케줄에서 이 반을 선택해 일정을 넣습니다.',
    },
  ],
  schedule: [
    {
      target: 'page-schedule-0',
      title: '스케줄 관리 화면',
      body: '달력으로 이번 달 수업 일정을 볼 수 있습니다. 요일별 반복 일정을 등록하면 해당 날짜에 수업이 자동 생성되므로, 매번 하나씩 넣을 필요가 없습니다.',
    },
    {
      target: 'page-schedule-create',
      title: '스케줄 생성',
      body: '"스케줄 생성" 버튼을 누르면 반복 일정을 등록하는 창이 열립니다. 클래스(반), 요일, 시간, 강의실을 정하면 해당 조건에 맞는 수업이 달력에 채워집니다. 직접 눌러 보세요.',
      actionHint: 'click',
      tip: '클래스(반)를 먼저 만들어 두어야 스케줄에 선택할 수 있습니다.',
    },
    {
      target: 'page-schedule-0',
      title: '세션 링크로 홍보하기',
      body: '달력에서 개별 수업(세션)을 누르면 상세 창이 열리고, 그 안에 "결제 링크 복사" 버튼이 있습니다. 이 링크를 인스타·카톡에 공유하면 회원이 바로 그 수업을 결제·신청할 수 있어요.',
      tip: '특정 워크샵·특강을 홍보할 때 특히 유용합니다.',
    },
  ],
  enrollments: [
    {
      target: 'page-enrollments-0',
      title: '신청인원 관리 화면',
      body: '날짜·수업·상태(확정/대기/출석완료/취소)로 필터링해 신청 목록을 볼 수 있습니다. 수업을 선택하면 해당 수업의 신청자만 모아서 볼 수 있습니다.',
    },
    {
      target: 'page-enrollments-add',
      title: '수기 추가',
      body: '"수기 추가" 버튼을 누르면 회원을 수업에 직접 등록하는 창이 열립니다. 앱으로 신청하지 않은 회원을 관리자만 등록할 때 사용합니다. 한 번 눌러 보세요.',
      actionHint: 'click',
      tip: '회원 선택 후 사용할 수강권을 지정하면 출석 시 차감됩니다.',
    },
  ],
  products: [
    {
      target: 'page-products-0',
      title: '수강권/상품 화면',
      body: '기간제·쿠폰제(횟수제)·워크샵(특강) 수강권과 할인 정책을 한 화면에서 관리합니다. 탭으로 유형별로 나누어 보고, 검색으로 이름·가격·유형을 찾을 수 있습니다.',
    },
    {
      target: 'page-products-add',
      title: '새 상품 추가',
      body: '"새 상품 추가" 버튼을 누르면 수강권(이름, 가격, 횟수/기간, 적용 클래스)을 등록하는 모달이 열립니다. 할인은 별도 "할인 추가"로 설정할 수 있습니다. 버튼을 눌러 보세요.',
      actionHint: 'click',
      tip: '만든 수강권 옆 링크 아이콘을 누르면 "구매 링크"가 복사돼, 그대로 홍보에 쓸 수 있습니다.',
    },
  ],
  logs: [
    {
      target: 'page-logs-0',
      title: '업무/수업 일지 화면',
      body: '날짜를 선택하면 그날 스케줄된 수업 목록이 나옵니다. 수업별로 "일지 작성하기"를 누르면 출석·메모를 기록하고, 오른쪽 "운영 메모"에는 센터 운영 특이사항을 적을 수 있습니다.',
    },
  ],
  students: [
    { target: 'page-students-0', title: '학생 관리', body: '등록된 회원 목록을 확인하고, 신규 회원을 등록할 수 있습니다.' },
  ],
  instructors: [
    { target: 'page-instructors-0', title: '강사 관리', body: '강사 프로필을 등록하고 학원에 연결합니다. 등록한 강사는 클래스(반)와 스케줄에서 선택할 수 있습니다.' },
  ],
  consultations: [
    { target: 'page-consultations-0', title: '상담 관리', body: '상담·문의 내용을 등록하고 진행 상황을 관리합니다.' },
  ],
  revenue: [
    {
      target: 'page-revenue-0',
      title: '매출/정산 · 수강권 간편결제',
      body: '매출 현황을 확인하고, "판매" 탭에서 회원에게 수강권을 바로 판매·결제할 수 있습니다. 헤더의 "수강권 간편결제"와 동일한 화면입니다.',
    },
  ],
};

export function getPageKeyFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/academy-admin\/[^/]+\/([^/?#]+)/);
  if (match) return match[1];
  if (pathname.match(/\/academy-admin\/[^/]+$/)) return 'dashboard';
  return null;
}

/**
 * 사이드바 스텝에서 "이동하기" 클릭 시 실제로 이동할 URL.
 * 스텝 객체가 path/query를 직접 들고 있으므로 별도 매핑 테이블이 필요 없다.
 */
export function getSidebarStepUrl(academyId: string, step: SidebarStep): string {
  const base = `/academy-admin/${academyId}`;
  const pathPart = step.path ? `${base}/${step.path}` : base;
  return step.query ? `${pathPart}?${step.query}` : pathPart;
}
