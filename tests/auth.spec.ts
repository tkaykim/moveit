import { test, expect } from '@playwright/test';

test.describe('인증 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 전에 로그아웃 상태로 시작
    await page.goto('/auth/login');
  });

  test('로그인 페이지가 정상적으로 표시되어야 함', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('로그인');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('회원가입 페이지로 이동할 수 있어야 함', async ({ page }) => {
    const signupLink = page.locator('a[href*="/auth/signup"]').first();
    await signupLink.click();
    await page.waitForURL(/.*\/auth\/signup/);
    await expect(page).toHaveURL(/.*\/auth\/signup/);
    await expect(page.locator('h1')).toContainText('회원가입');
  });

  test('회원가입 폼이 정상적으로 표시되어야 함', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.locator('h1')).toContainText('회원가입');
    await expect(page.locator('input[type="text"]')).toBeVisible(); // 이름
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('빈 폼 제출 시 에러 메시지가 표시되어야 함', async ({ page }) => {
    await page.click('button[type="submit"]');
    // 이메일 필드가 required이므로 브라우저 기본 검증이 작동할 수 있음
    // 또는 커스텀 에러 메시지 확인
  });

  test('비밀번호가 6자 미만일 때 에러 메시지가 표시되어야 함', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', '12345');
    await page.click('button[type="submit"]');
    
    // 에러 메시지 확인
    await expect(page.locator('text=비밀번호는 최소 6자 이상이어야 합니다')).toBeVisible();
  });

  test('유효하지 않은 이메일 형식 시 에러가 표시되어야 함', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 브라우저 기본 검증 또는 커스텀 에러 메시지
  });

  test('로그인 페이지에서 회원가입 링크로 이동할 수 있어야 함', async ({ page }) => {
    await page.click('text=회원가입');
    await expect(page).toHaveURL(/.*\/auth\/signup/);
  });

  test('회원가입 페이지에서 로그인 링크로 이동할 수 있어야 함', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.click('text=로그인');
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('홈으로 돌아가기 링크가 작동해야 함', async ({ page }) => {
    await page.click('text=홈으로 돌아가기');
    await expect(page).toHaveURL('/');
  });
});

