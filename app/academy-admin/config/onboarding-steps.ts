/**
 * 관리자 온보딩 튜토리얼 단계 정의
 * - 전역: 환영 + 사이드바 7개 메뉴 + 수강권 간편결제
 * - 페이지별: 각 페이지에서 실제로 눌러볼 수 있는 버튼/영역별 디테일 스텝
 */

export type OnboardingPhase = 'welcome' | 'sidebar' | 'page' | 'done';

export interface SidebarStep {
  type: 'sidebar';
  target: string;
  label: string;
  message: string;
}

export interface WelcomeStep {
  type: 'welcome';
  target: null;
  title: string;
  body: string;
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

export type GlobalStep = WelcomeStep | SidebarStep;

export const GLOBAL_STEPS: GlobalStep[] = [
  {
    type: 'welcome',
    target: null,
    title: 'MOVE IT 관리자 둘러보기',
    body: '대시보드, 클래스·스케줄·수강권 관리, 수강권 간편결제까지 주요 기능을 순서대로 안내합니다. 각 메뉴로 이동한 뒤, 실제로 사용하는 버튼을 눌러 보시면 바로 활용하실 수 있습니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-0',
    label: '대시보드',
    message: '"이동하기"를 누르면 대시보드 페이지로 이동합니다. 오늘 수업 일정과 클래스·스케줄·신청인원·수강권 바로가기를 보면서 설명을 진행합니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-2',
    label: '클래스(반) 관리',
    message: '"이동하기"를 누르면 클래스(반) 관리 페이지로 이동합니다. 반 추가·수강권 연결 화면을 보면서 기능을 안내합니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-3',
    label: '스케줄 관리',
    message: '"이동하기"를 누르면 스케줄 관리 페이지로 이동합니다. 반복 일정 등록·달력 화면을 보면서 설명합니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-4',
    label: '신청인원 관리',
    message: '"이동하기"를 누르면 신청인원 관리 페이지로 이동합니다. 수업별 신청·수기 추가 화면을 보면서 안내합니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-5',
    label: '수강권/상품',
    message: '"이동하기"를 누르면 수강권/상품 페이지로 이동합니다. 기간제·쿠폰제(횟수제)·워크샵(특강) 수강권과 할인 설정 화면을 보면서 설명합니다.',
  },
  {
    type: 'sidebar',
    target: 'sidebar-6',
    label: '업무/수업 일지',
    message: '"이동하기"를 누르면 업무/수업 일지 페이지로 이동합니다. 날짜별 일지·운영 메모 화면을 보면서 안내합니다.',
  },
  {
    type: 'sidebar',
    target: 'header-quick-pay',
    label: '수강권 간편결제',
    message: '"이동하기"를 누르면 매출/정산(판매) 페이지로 이동합니다. 회원에게 수강권을 바로 판매하는 화면을 보면서 설명합니다.',
  },
];

/** 페이지별 스텝: 실제로 이동·클릭해 보는 요소 중심, 디테일한 설명 */
export const PAGE_STEPS: Record<string, PageStepDef[]> = {
  dashboard: [
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
    {
      target: 'page-dashboard-card-0',
      title: '클래스 관리 바로가기',
      body: '이 카드를 누르면 클래스(반) 관리 페이지로 이동합니다. 반 추가·수정, 수강권 연결을 여기서 시작할 수 있습니다.',
      actionHint: 'click',
    },
    {
      target: 'page-dashboard-card-1',
      title: '스케줄 관리 바로가기',
      body: '스케줄 관리 페이지로 이동합니다. 반복 일정 생성, 일별 수업 확인·수정을 할 수 있습니다.',
      actionHint: 'click',
    },
    {
      target: 'page-dashboard-card-2',
      title: '신청인원 관리 바로가기',
      body: '신청인원 관리 페이지로 이동합니다. 수업별 예약·등록 현황과 수기 추가를 관리합니다.',
      actionHint: 'click',
    },
    {
      target: 'page-dashboard-card-3',
      title: '수강권 관리 바로가기',
      body: '수강권/상품 페이지로 이동합니다. 기간제·쿠폰제(횟수제)·워크샵(특강) 수강권과 할인 설정을 여기서 합니다.',
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
      tip: '수강권은 클래스(반)와 연결해 두면, 해당 반 수업 출석 시에만 사용 가능합니다.',
    },
  ],
  logs: [
    {
      target: 'page-logs-0',
      title: '업무/수업 일지 화면',
      body: '날짜를 선택하면 그날 스케줄된 수업 목록이 나옵니다. 수업별로 "일지 작성하기"를 누르면 출석·메모를 기록하고, 오른쪽 "운영 메모"에는 센터 운영 특이사항을 적을 수 있습니다.',
    },
    {
      target: 'page-logs-date',
      title: '날짜 선택',
      body: '위에서 날짜를 바꾸면 해당 날짜의 수업과 일지가 로드됩니다. 오늘 날짜를 선택한 뒤, 아래 수업 목록에서 "일지 작성하기"를 눌러 보세요.',
      tip: '미작성 일지는 노란색으로 표시됩니다.',
    },
    {
      target: 'page-logs-note',
      title: '운영 메모',
      body: '오늘 센터 운영 관련 특이사항(예: 시설 점검, 비품 구매)을 자유롭게 적을 수 있습니다. "메모 저장"으로 저장되며, 날짜별로 유지됩니다.',
    },
  ],
  students: [
    { target: 'page-students-0', title: '학생 관리', body: '등록된 회원 목록을 확인하고, 신규 회원을 등록할 수 있습니다.' },
  ],
  instructors: [
    { target: 'page-instructors-0', title: '강사 관리', body: '강사 프로필을 등록하고 학원에 연결합니다.' },
  ],
  consultations: [
    { target: 'page-consultations-0', title: '상담 관리', body: '상담·문의 내용을 등록하고 진행 상황을 관리합니다.' },
  ],
  revenue: [
    {
      target: 'page-revenue-0',
      title: '매출/정산',
      body: '매출 현황을 확인하고, 수강권 간편결제로 판매할 수 있습니다. 헤더의 "수강권 간편결제"와 동일한 판매 화면으로 이동합니다.',
    },
  ],
  settings: [
    { target: 'page-settings-0', title: '설정', body: '학원 정보와 운영 설정을 변경합니다.' },
  ],
};

export function getPageKeyFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/academy-admin\/[^/]+\/([^/?#]+)/);
  if (match) return match[1];
  if (pathname.match(/\/academy-admin\/[^/]+$/)) return 'dashboard';
  return null;
}

export const SIDEBAR_STEP_TO_PAGE_KEY: Record<number, string> = {
  1: 'dashboard',
  2: 'class-masters',
  3: 'schedule',
  4: 'enrollments',
  5: 'products',
  6: 'logs',
  7: 'revenue',
};

/** 사이드바 단계(1~7)별 이동 경로. 빈 문자열이면 대시보드(루트) */
const SIDEBAR_STEP_PATH: Record<number, string> = {
  1: '',
  2: 'class-masters',
  3: 'schedule',
  4: 'enrollments',
  5: 'products',
  6: 'logs',
  7: 'revenue',
};

/** 사이드바 단계별 쿼리 (수강권 간편결제 = 매출/정산 판매 탭) */
const SIDEBAR_STEP_QUERY: Record<number, string> = {
  7: 'tab=sales',
};

/**
 * 사이드바 단계에서 "이동하기" 클릭 시 실제로 이동할 URL
 * 이동 후 pathname 변경으로 context가 phase를 'page'로 바꾸고 해당 페이지 뷰 + 스텝 설명 표시
 */
export function getSidebarStepUrl(academyId: string, stepIndex: number): string {
  const base = `/academy-admin/${academyId}`;
  const path = SIDEBAR_STEP_PATH[stepIndex] ?? '';
  const query = SIDEBAR_STEP_QUERY[stepIndex] ?? '';
  const pathPart = path ? `${base}/${path}` : base;
  return query ? `${pathPart}?${query}` : pathPart;
}
