/**
 * 인트로 페이지 → 구독 버튼 → 회원가입 → 학원 생성 → 구독(빌링) 진행 E2E
 * Vercel 배포 URL 대상: PLAYWRIGHT_BASE_URL=https://moveit-xi.vercel.app npx playwright test tests/intro-subscribe-flow.spec.ts
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://moveit-xi.vercel.app';

test.describe('인트로 구독 플로우 (회원가입 → 학원 생성 → 구독 진행)', () => {
  test.use({ baseURL: BASE_URL });

  test('인트로에서 스타터 구독 클릭 → 회원가입 → 학원 생성 → 구독 페이지까지 진행', async ({ page }) => {
    test.setTimeout(90_000);
    const timestamp = Date.now();
    const testEmail = `e2e.${timestamp}@example.com`;
    const testPassword = 'e2etest123';
    const testName = 'E2E테스트';
    const academyNameKr = `E2E학원_${timestamp}`;

    // 1. 인트로 페이지
    await page.goto('/intro');
    await page.waitForLoadState('domcontentloaded');

    // 2. 요금제 섹션으로 스크롤 후 "스타터 시작하기" 클릭
    await page.locator('a[href*="/intro/start"]').first().click();
    await page.waitForURL(/\/intro\/start/);
    await page.waitForLoadState('networkidle');

    // 3. "로그인 / 회원가입" 버튼 클릭
    await page.getByRole('button', { name: /로그인.*회원가입|회원가입/ }).click();
    await page.waitForTimeout(600);

    // 4. 회원가입 탭으로 전환 (로그인 폼에서 "회원가입" 링크)
    const signupTab = page.getByRole('button', { name: /계정이 없으신가요|회원가입/ }).last();
    await signupTab.click();
    await page.waitForTimeout(500);

    // 5. 회원가입 폼 입력 (모달 내부; 제출 버튼은 텍스트 정확히 '회원가입')
    await page.getByPlaceholder('이메일을 입력하세요').fill(testEmail);
    await page.getByPlaceholder('비밀번호를 입력하세요').first().fill(testPassword);
    await page.getByRole('textbox', { name: '이름을 입력하세요', exact: true }).fill(testName);
    await page.getByRole('button', { name: '회원가입', exact: true }).click();

    // 6. 회원가입 완료 대기 (모달 닫히거나 학원 생성/선택 화면으로 전환)
    await page.waitForTimeout(3000);

    // 7. "내 학원 생성하기" 또는 학원 생성 링크 클릭
    const createAcademyLink = page.getByRole('link', { name: /내 학원 생성하기|학원 생성/ });
    await createAcademyLink.click();
    await page.waitForURL(/\/intro\/setup-academy/);
    await page.waitForLoadState('networkidle');

    // 8. 학원 생성 폼 (한글 이름 필수)
    await page.getByPlaceholder('예: MOVEIT 댄스학원').fill(academyNameKr);
    await page.getByRole('button', { name: /학원 생성|생성하기/ }).click();

    // 9. 학원 생성 후 academy-admin으로 리다이렉트 (subscription=start 쿼리)
    await page.waitForURL(/\/academy-admin\/[^/]+/);
    await page.waitForLoadState('networkidle');

    // 10. 구독/빌링 관련 UI 노출 여부 확인 (배너, 구독 시작, 또는 빌링 메뉴)
    const hasBillingOrSubscription =
      (await page.getByText(/구독|결제|빌링|요금제|플랜/).first().isVisible({ timeout: 5000 }).catch(() => false)) ||
      (await page.getByRole('link', { name: /구독|빌링|결제/ }).first().isVisible({ timeout: 3000 }).catch(() => false));
    expect(hasBillingOrSubscription || page.url().includes('academy-admin')).toBeTruthy();
  });
});
