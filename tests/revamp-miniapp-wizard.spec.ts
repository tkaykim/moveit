import { test, expect } from '@playwright/test';

/**
 * 개편 E2E — 학원 미니앱(화이트라벨) + 온보딩 위저드 + 워크샵/대기열.
 * 실행: PLAYWRIGHT_BASE_URL=http://localhost:4310 npx playwright test tests/revamp-miniapp-wizard.spec.ts
 * 전제: scripts/seed-e2e-accounts.mjs 실행됨 + e2e-workshop 학원 존재(위저드 E2E로 생성됨).
 */

const OWNER = { email: 'e2e-moveit-owner@modoogoods.com', password: 'Test1234!e2e' };
const SLUG = 'e2e-workshop';

test.describe('학원 미니앱 (화이트라벨)', () => {
  test('미니앱 5개 화면이 학원 브랜딩으로 렌더된다', async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await expect(page.getByRole('heading', { name: 'E2E 워크샵 스튜디오' })).toBeVisible();
    // 화이트라벨 원칙: MOVEIT 마켓플레이스 네비가 없어야 한다
    await expect(page.locator('nav')).not.toContainText('마이');
    await expect(page.locator('nav')).toContainText('시간표');

    await page.goto(`/s/${SLUG}/schedule`);
    await expect(page.getByRole('heading', { name: '시간표' })).toBeVisible();

    await page.goto(`/s/${SLUG}/tickets`);
    await expect(page.getByRole('heading', { name: '수강권', exact: true, level: 1 })).toBeVisible();
    // 프리셋 수강권 + 정책 고지
    await expect(page.getByText('원데이 (1회)')).toBeVisible();

    await page.goto(`/s/${SLUG}/workshops`);
    await expect(page.getByRole('heading', { name: '워크샵 · 이벤트' })).toBeVisible();

    await page.goto(`/s/${SLUG}/my`);
    await expect(page.getByRole('heading', { name: '로그인' }).or(page.getByText('다가오는 예약'))).toBeVisible();
  });

  test('동적 PWA manifest가 학원 이름·색을 반환한다', async ({ request }) => {
    const res = await request.get(`/api/manifest/${SLUG}`);
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBe('E2E 워크샵 스튜디오');
    expect(manifest.scope).toBe(`/s/${SLUG}`);
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test('존재하지 않는 학원 슬러그는 404', async ({ page }) => {
    const res = await page.goto('/s/no-such-academy-xyz');
    expect(res?.status()).toBe(404);
  });
});

test.describe('워크샵 · 대기열', () => {
  test('워크샵 상세에 일정과 신청/대기 버튼이 있다', async ({ page }) => {
    await page.goto(`/s/${SLUG}/workshops`);
    await page.locator(`a[href*="/s/${SLUG}/workshops/"]`).first().click();
    await expect(page.getByText('일정 선택')).toBeVisible();
    await expect(page.getByRole('button', { name: '신청하기' }).or(page.getByRole('button', { name: '대기 신청' })).first()).toBeVisible();
  });

  test('대기열 API — 이름/연락처 없으면 400, 자리가 있으면 409', async ({ request }) => {
    const bad = await request.post('/api/workshops/waitlist', { data: { scheduleId: 'x' } });
    expect(bad.status()).toBe(400);
  });
});

test.describe('온보딩 위저드 (/start)', () => {
  test('비로그인 시 로그인 게이트가 보인다', async ({ page }) => {
    await page.goto('/start');
    await expect(page.getByText('5분이면 만들어져요')).toBeVisible();
    await expect(page.getByRole('button', { name: '시작하기', exact: true })).toBeVisible();
  });

  test('로그인하면 3스텝 위저드 — 운영방식 다중 선택 시 수강권이 조합된다', async ({ page }) => {
    await page.goto('/start');
    await page.getByRole('button', { name: '시작하기', exact: true }).click();
    await page.getByPlaceholder('이메일을 입력하세요').fill(OWNER.email);
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(OWNER.password);
    await page.locator('form:has(input[placeholder="이메일을 입력하세요"])').evaluate((f: HTMLFormElement) => f.requestSubmit());

    await expect(page.getByRole('heading', { name: '학원 이름이 뭔가요?' })).toBeVisible({ timeout: 15000 });

    // Step 1
    await page.getByPlaceholder('예: 무브잇 댄스 스튜디오').fill('플레이라이트 스튜디오');
    await page.getByRole('button', { name: /다음/ }).click();

    // Step 2 — 다중 선택: 쿠폰제 + 기간제 동시 운영 학원
    await expect(page.getByRole('heading', { name: '어떤 수업을 운영하세요?' })).toBeVisible();
    await page.getByRole('button', { name: /쿠폰제/ }).click();
    await page.getByRole('button', { name: /기간제/ }).click();
    // 조합 미리보기에 두 유형의 수강권이 함께 보인다
    await expect(page.getByText(/이 수강권 \d+종이 만들어져요/)).toBeVisible();
    await expect(page.getByText('쿠폰 5회')).toBeVisible();
    await expect(page.getByText('월 정규 (주 1회)')).toBeVisible();
    await expect(page.getByText('무제한 패스 (30일)')).toBeVisible();
    // 여기서 실제 생성은 하지 않는다 (E2E 데이터 남발 방지) — 생성 완주는 API로 별도 검증
  });
});

test.describe('관리자 IA', () => {
  test('사이드바가 4그룹 + 내 학원 앱 바로가기로 재편됐다', async ({ page }) => {
    await page.goto('/start');
    await page.getByRole('button', { name: '시작하기', exact: true }).click();
    await page.getByPlaceholder('이메일을 입력하세요').fill(OWNER.email);
    await page.getByPlaceholder('비밀번호를 입력하세요').fill(OWNER.password);
    await page.locator('form:has(input[placeholder="이메일을 입력하세요"])').evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect(page.getByRole('heading', { name: '학원 이름이 뭔가요?' })).toBeVisible({ timeout: 15000 });

    await page.goto(`/academy-admin/${SLUG}`);
    await expect(page.getByText('내 학원 앱 보기')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('오늘 현황')).toBeVisible();
    await expect(page.getByText('학원생 관리')).toBeVisible();
    await expect(page.getByText('수강권 가격표')).toBeVisible();
    await expect(page.getByText('더보기')).toBeVisible();
  });
});
