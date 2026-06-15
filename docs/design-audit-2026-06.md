# UI/UX 디자인 감사 기록 (2026-06-15)

> 대표(디자인 책임자) 기준: **flat · 최소 색상 · 노네온 · 노블러**. "AI스러운" 그라데이션 글로우/글래스모피즘/무지개색 회피.
> 검수 방식: 운영(moveit-xi.vercel.app)에서 Chrome으로 모바일 뷰 E2E + 카드 내부·다크모드·대비 확대 점검 → 수정 → 재배포 → 시각 검증 반복.
> 관련 메모리: `~/.claude/projects/.../memory/design-flat-no-neon.md`, `moveit-security-rls-gap.md`.

## 수정 완료 (모두 배포·시각 검증)

### 기능 결함
- **죽은 검색바**: 단일학원 모드(`NEXT_PUBLIC_HIDE_PUBLIC_ACADEMIES`)에서 통합검색 비활성(/search→/home)인데 홈 검색바만 노출 → 같은 플래그로 숨김. (home-view)
- **QR 시뮬레이션 우측 흰 띠**: `aspect-square+max-h-[200px]`가 정사각형으로 줄어 카드보다 좁음 → `w-full h-[200px]`. (feature-qr)
- **종료된 수업 예약버튼 활성**: 월간 캘린더서 과거 날짜도 열려 '예약하기' 활성(누르면 서버 에러) → `endTime` 기반 `isPast`로 버튼 비활성+'종료된 수업'. (class-preview-modal)

### 접근성 · 대비 (다크모드 / WCAG)
- **다크모드 텍스트 실종**: `text-neutral-800`에 `dark:` variant 없어 어두운 배경서 사라짐 → 로고 점(.)·내 학원 가격에 `dark:text-neutral-100`.
- **밝은 primary(#7AB2D3) 위 흰 글씨 저대비**: `bg-primary text-white` → `text-neutral-900` (수업시트 예약하기, 주간/월간 스케줄 선택일, 마이 QR버튼).

### 정렬 · 레이아웃
- **수강권 요약 라벨 줄바꿈**: '쿠폰제(횟수제)'가 좁은 1/3 카드서 2줄로 깨짐 → 요약 전용 i18n '횟수제'/'워크샵'로 단축(`my.countTicket`/`my.workshopTicket`, 구매 흐름 풀라벨은 유지).

### 플랫 디자인 (노네온 · 노블러 · 최소 색상)
- **글래스모피즘 제거**: 홈/학원목록/지도/알림 스티키 헤더 + 하단 네비의 `backdrop-blur` 반투명/그라데이션 → 솔리드 배경 + 얇은 하단 경계선.
- **아바타 무지개 그라데이션 링**: `from-primary to-green-500` → 중성 플랫 링. 폴백(my-page-view, settings-view) + 이미지 표시 공용 컴포넌트(profile-image-upload) 모두.
- **인트로 네온/블러**: 기능 5개 카드 뒤 다색 블러 오브(blur-2xl, purple/blue/indigo/emerald/teal/orange/amber) 제거, 비교카드 40px 컬러 글로우+blur 오브 제거, CTA 네온 펄스(box-shadow glow) → 스케일만.
- **사진 위 컨트롤 블러 제거 + 히어로 토글 통일**: 학원 히어로 back/하트/이미지 라이트박스 `backdrop-blur`→솔리드; EN/테마 토글에 어두운 backing+흰 아이콘으로 back/하트와 통일.
- **버튼 과한 그림자/확대 제거**: 수업시트 예약버튼 `shadow-lg hover:shadow-xl hover:scale` → 플랫.

### 일관성
- **일정 탭 테마토글 추가**: 다른 탭 헤더와 통일.
- **월간 캘린더 과거 날짜 흐림**: `opacity-50` — 종료=예약불가 시각 구분.

## 유지(의도적 — "AI스럽다" 아님, 기능적)
- 사진 위 텍스트 가독용 그라데이션 스크림(`from-black/80 to-transparent`).
- 기능 의미 전달용 색상 pill 배지(시간대/학원/장르/레벨).
- QR 스캔라인(스캔 동작 메타포).
- 베이스 팔레트(`--primary #7AB2D3` 하늘색 + 민트/시안 muted)는 이미 차분 — 네온 아님, 새 색 추가 금지.

## 남은 항목 (비차단 / 범위 외)
- 결제내역에서 과거 수업이 '대기중' 표시 → 상태 로직(디자인 아님), 별도 점검 필요.
- 학원 업로드 이미지 시간표 모바일 가독성 → 학원 콘텐츠 영역.
- 데스크톱 와이드 여백 → 모바일 우선 앱의 중앙 고정폭, 구조적 결정 필요.
- 디스커버리/강사상세(dancer-list, academy-list/map, search-results, dancer-detail) → 단일학원 모드라 현재 숨김(비활성). 활성화 시 동일 기준으로 블러/그라데이션 재점검 필요(해당 파일에 backdrop-blur 잔존).

## 평가
핵심 고객 여정(홈→학원→캘린더→수업시트→예약 퍼널→마이/일정/설정/결제내역)은 막힘·깨짐·다크모드 실종·저대비·죽은버튼 없이 플랫·일관되게 정리됨 → **UI/UX 측면 출시 가능 수준.**
