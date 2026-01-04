import { test, expect } from '@playwright/test';

test.describe('로그인 테스트 페이지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/logintest');
    await page.waitForLoadState('networkidle');
  });

  test('페이지 로드 확인', async ({ page }) => {
    // 페이지 제목 확인
    await expect(page.locator('h1')).toContainText('인증 테스트 페이지');
    
    // 컨트롤 버튼 확인
    await expect(page.locator('button:has-text("회원가입 테스트")')).toBeVisible();
    await expect(page.locator('button:has-text("로그인 테스트")')).toBeVisible();
    
    // 로그 패널 확인
    await expect(page.locator('text=인증 테스트 로그')).toBeVisible();
  });

  test('회원가입 모달 열기 및 닫기', async ({ page }) => {
    // 회원가입 버튼 클릭
    await page.click('button:has-text("회원가입 테스트")');
    
    // 모달이 열렸는지 확인
    await expect(page.locator('h2:has-text("회원가입")')).toBeVisible();
    
    // 닫기 버튼 클릭
    await page.click('button:has-text("✕")');
    
    // 모달이 닫혔는지 확인
    await expect(page.locator('h2:has-text("회원가입")')).not.toBeVisible();
  });

  test('로그인 모달 열기 및 닫기', async ({ page }) => {
    // 로그인 버튼 클릭
    await page.click('button:has-text("로그인 테스트")');
    
    // 모달이 열렸는지 확인
    await expect(page.locator('h2:has-text("로그인")')).toBeVisible();
    
    // 닫기 버튼 클릭
    await page.click('button:has-text("✕")');
    
    // 모달이 닫혔는지 확인
    await expect(page.locator('h2:has-text("로그인")')).not.toBeVisible();
  });

  test('회원가입 시도 및 로그 확인', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testPassword = '123123';
    const testName = '테스트 사용자';

    // 회원가입 모달 열기
    await page.click('button:has-text("회원가입 테스트")');
    await page.waitForSelector('h2:has-text("회원가입")');

    // 폼 작성
    await page.fill('#signup-name', testName);
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);

    // 회원가입 버튼 클릭
    await page.click('button[type="submit"]:has-text("회원가입")');

    // 로그 확인 (최대 5초 대기)
    await page.waitForTimeout(2000);

    // 로그 패널에서 로그 확인
    const logText = await page.locator('.bg-blue-50, .bg-green-50, .bg-red-50, .bg-yellow-50').first().textContent();
    console.log('로그 내용:', logText);

    // 로그가 생성되었는지 확인
    const logCount = await page.locator('text=/SIGNUP_/').count();
    expect(logCount).toBeGreaterThan(0);
  });

  test('로그인 시도 및 로그 확인', async ({ page }) => {
    const testEmail = 'tommy0621@naver.com';
    const testPassword = '123123';

    // 로그인 모달 열기
    await page.click('button:has-text("로그인 테스트")');
    await page.waitForSelector('h2:has-text("로그인")');

    // 폼 작성
    await page.fill('#login-email', testEmail);
    await page.fill('#login-password', testPassword);

    // 로그인 버튼 클릭
    await page.click('button[type="submit"]:has-text("로그인")');

    // 로그 확인 (최대 5초 대기)
    await page.waitForTimeout(3000);

    // 로그 패널에서 로그 확인
    const logText = await page.locator('.bg-blue-50, .bg-green-50, .bg-red-50, .bg-yellow-50').first().textContent();
    console.log('로그 내용:', logText);

    // 로그가 생성되었는지 확인
    const logCount = await page.locator('text=/LOGIN_/').count();
    expect(logCount).toBeGreaterThan(0);
  });

  test('반복 로그인 시도 (5번 이상 반복 오류 확인)', async ({ page }) => {
    const testEmail = 'wrong@email.com';
    const testPassword = 'wrongpassword';

    // 로그인 모달 열기
    await page.click('button:has-text("로그인 테스트")');
    await page.waitForSelector('h2:has-text("로그인")');

    // 폼 작성
    await page.fill('#login-email', testEmail);
    await page.fill('#login-password', testPassword);

    // 6번 반복 시도
    for (let i = 0; i < 6; i++) {
      console.log(`로그인 시도 ${i + 1}번째`);
      
      // 로그인 버튼 클릭
      await page.click('button[type="submit"]:has-text("로그인")');
      
      // 대기
      await page.waitForTimeout(2000);
      
      // 모달이 닫혔으면 다시 열기
      const isModalVisible = await page.locator('h2:has-text("로그인")').isVisible().catch(() => false);
      if (!isModalVisible && i < 5) {
        await page.click('button:has-text("로그인 테스트")');
        await page.waitForSelector('h2:has-text("로그인")');
        await page.fill('#login-email', testEmail);
        await page.fill('#login-password', testPassword);
      }
    }

    // 로그 확인
    await page.waitForTimeout(2000);

    // 반복 오류 로그 확인
    const repeatErrorLog = await page.locator('text=/REPEAT_ERROR/').count();
    console.log('반복 오류 로그 개수:', repeatErrorLog);
    
    // 5번 이상 반복 시 오류 로그가 생성되어야 함
    expect(repeatErrorLog).toBeGreaterThan(0);
  });

  test('로그 지우기 기능', async ({ page }) => {
    // 먼저 로그인 시도하여 로그 생성
    await page.click('button:has-text("로그인 테스트")');
    await page.waitForSelector('h2:has-text("로그인")');
    await page.fill('#login-email', 'test@example.com');
    await page.fill('#login-password', 'test123');
    await page.click('button[type="submit"]:has-text("로그인")');
    await page.waitForTimeout(2000);

    // 로그 지우기 버튼 클릭
    await page.click('button:has-text("로그 지우기")');

    // 로그가 지워졌는지 확인
    const emptyLogText = await page.locator('text=로그가 없습니다').textContent();
    expect(emptyLogText).toContain('로그가 없습니다');
  });
});

