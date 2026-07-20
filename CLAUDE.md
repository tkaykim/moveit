# moveit — 작업 노트

> **정본(SSoT)은 전역 `~/.claude/` 에 있다. 추측 말고 거기부터 읽는다.**
> - 규칙·1문장1줄·전사 원칙 → `~/.claude/CLAUDE.md`
> - 기능 구현됐나·어디에 → `~/.claude/CAPABILITY_MAP.md`
> - 외부 연동·계정·인증 → `~/.claude/INTEGRATIONS.md`
> - 지금 실제로 도는 자동화(런타임) → 허브 `automations` 테이블
> - 사업부·프로젝트·피드백·참조 → `~/.claude/projects/.../memory/MEMORY.md`
>
> **이 파일엔 규칙·연동·구현여부를 복붙하지 않는다.** 충돌 시 전역 우선.
> 이 레포의 도메인 지식은 [AGENTS.md](AGENTS.md) 와 `docs/` 를 읽는다.

---

## 이 레포에서만 유효한 것 (로컬 노트)

- **BU / 역할**: moveit — 댄스학원 예약·출석·결제 플랫폼(B2B2C). 학원별 화이트라벨 미니앱이 본질.
- **스택 / 배포**: Next.js 14 App Router · Supabase · Toss · Capacitor 래퍼 / Vercel `moveit`(prod `moveit-xi.vercel.app`)
- **실행**: `npm run dev` (메모리 4GB 지정됨) · 빌드 `npm run build` · 린트 `npm run lint`
- **테스트**: `npx playwright test --workers=1` — **병렬 금지**(라이브 DB 공유 픽스처 경합)
- **Supabase ref**: `vjxnollfggbufpqldxrb` (키·env 상세는 전역 INTEGRATIONS.md)
- **E2E 계정**: `e2e-moveit-owner@modoogoods.com` / `e2e-moveit-student@modoogoods.com` (pw `Test1234!e2e`)

## 이 레포 특이사항 (함정)

- **`types/database.ts`는 수기 섹션이 있다 — 전체 재생성 금지.** 신규 타입은 부분 추가만.
- **DB는 라이브 프로덕션이며 `mid-class-board`(별도 레포)가 service role로 같은 DB를 쓴다.** 그 앱과 `C:\MID_WORK` 동기화를 깨뜨리지 않는다.
- `classes.status` CHECK는 한글(`정상`/`연기됨`/`취소됨`), `bookings.status`는 **`CANCELLED`(L 두 개)**.
- `recurring_schedules.academy_id` NOT NULL.
- 도메인 규칙·보안 모델·운영 절차는 [AGENTS.md](AGENTS.md) → `docs/` 로 이어진다.
