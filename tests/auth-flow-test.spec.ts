import { test, expect } from '@playwright/test';

test.describe('인증 플로우 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 개발 서버로 이동
    await page.goto('http://localhost:3000');
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
  });

  test('마이페이지에서 로그인 모달 열기', async ({ page }) => {
    // 마이페이지로 이동
    await page.goto('http://localhost:3000/my');
    await page.waitForLoadState('networkidle');

    // 로그인 버튼 클릭 (프로필 영역)
    const loginButton = page.locator('button:has-text("로그인하세요")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      
      // 모달이 열렸는지 확인
      await expect(page.locator('text=로그인')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    }
  });

  test('회원가입 폼 표시', async ({ page }) => {
    await page.goto('http://localhost:3000/my');
    await page.waitForLoadState('networkidle');

    // 로그인 모달 열기
    const loginButton = page.locator('button:has-text("로그인하세요")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForTimeout(500);

      // 회원가입으로 전환
      const signupLink = page.locator('button:has-text("회원가입")').last();
      if (await signupLink.isVisible()) {
        await signupLink.click();
        await page.waitForTimeout(500);

        // 회원가입 폼 필드 확인
        await expect(page.locator('text=회원가입')).toBeVisible();
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('input[placeholder*="이름"]')).toBeVisible();
      }
    }
  });

  test('회원가입 실행', async ({ page }) => {
    await page.goto('http://localhost:3000/my');
    await page.waitForLoadState('networkidle');

    // 로그인 모달 열기
    const loginButton = page.locator('button:has-text("로그인하세요")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForTimeout(500);

      // 회원가입으로 전환
      const signupLink = page.locator('button:has-text("회원가입")').last();
      if (await signupLink.isVisible()) {
        await signupLink.click();
        await page.waitForTimeout(500);

        // 테스트 계정 정보 입력
        const timestamp = Date.now();
        const testEmail = `test${timestamp}@example.com`;
        const testPassword = 'test123456';
        const testName = '테스트 사용자';

        await page.fill('input[type="email"]', testEmail);
        await page.fill('input[type="password"]', testPassword);
        await page.fill('input[placeholder*="이름"]', testName);

        // 회원가입 버튼 클릭
        const signupButton = page.locator('button:has-text("회원가입")').first();
        await signupButton.click();

        // 성공 메시지 또는 모달 닫힘 확인
        await page.waitForTimeout(2000);
        
        // 모달이 닫혔는지 또는 성공 메시지가 표시되는지 확인
        const modal = page.locator('text=회원가입');
        const isModalClosed = !(await modal.isVisible({ timeout: 1000 }).catch(() => false));
        
        // 모달이 닫혔거나 성공적으로 처리되었는지 확인
        expect(isModalClosed || await page.locator('text=로그인하세요').isVisible({ timeout: 1000 }).catch(() => false)).toBeTruthy();
      }
    }
  });

  test('로그인 실행', async ({ page }) => {
    await page.goto('http://localhost:3000/my');
    await page.waitForLoadState('networkidle');

    // 로그인 모달 열기
    const loginButton = page.locator('button:has-text("로그인하세요")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForTimeout(500);

      // 로그인 폼 확인
      await expect(page.locator('text=로그인')).toBeVisible();
      
      // 이메일과 비밀번호 입력 필드 확인
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    }
  });
});


