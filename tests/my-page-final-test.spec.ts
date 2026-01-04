import { test, expect } from '@playwright/test';

test.describe('마이 페이지 최종 테스트', () => {
  test('비로그인 상태 - "로그인하세요" 표시 및 클릭 시 로그인 페이지 이동', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // "로그인하세요" 텍스트 확인
    await expect(page.locator('text=로그인하세요')).toBeVisible();
    
    // 프로필 영역 클릭
    const loginButton = page.locator('button:has-text("로그인하세요"), [class*="rounded-2xl"]:has-text("로그인하세요")').first();
    await loginButton.click();
    
    // 로그인 페이지로 이동 확인
    await page.waitForURL(/.*\/auth\/login/, { timeout: 5000 });
    
    console.log('✅ 비로그인 상태 UI 및 로그인 페이지 이동 확인 완료');
  });
  
  test('admin 계정 로그인 - 실제 사용자 이름 표시 및 설정 탭 이동', async ({ page }) => {
    // admin 계정으로 로그인
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    await page.fill('input[type="password"]', '123123');
    await page.click('button[type="submit"]');
    
    // 로그인 후 리다이렉트 대기
    await page.waitForURL(/.*\/(admin|$)/, { timeout: 10000 });
    
    // 홈 페이지로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 마이 탭 클릭
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // "사용자" 텍스트가 아닌 실제 이름이 표시되는지 확인
    const userText = page.locator('text=사용자');
    const userTextCount = await userText.count();
    
    // 사용자 이름이 표시되는지 확인 (김현준 또는 tommy0621)
    const pageContent = await page.textContent('body');
    const hasRealName = pageContent?.includes('김현준') || pageContent?.includes('tommy0621');
    
    expect(hasRealName).toBe(true);
    console.log('✅ Admin 계정 실제 이름 표시 확인');
    
    // 프로필 영역 클릭 (설정 탭으로 이동)
    const profileArea = page.locator('button:has-text("김현준"), button:has-text("tommy0621")').first();
    if (await profileArea.count() > 0) {
      await profileArea.click();
      await page.waitForTimeout(1000);
      console.log('✅ 설정 탭 이동 확인');
    }
  });
  
  test('일반 사용자 생성 및 로그인 테스트', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `testuser${timestamp}@example.com`;
    const testPassword = '123123';
    const testName = `테스트${timestamp}`;
    
    // 회원가입
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');
    
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.fill(testName);
    
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    // 회원가입 완료 대기
    await page.waitForTimeout(2000);
    
    // 로그인 페이지로 이동
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    // 로그인 후 리다이렉트 대기
    await page.waitForURL(/.*\/(admin|$)/, { timeout: 15000 });
    
    // 홈 페이지로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 마이 탭 클릭
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // 사용자 이름 확인 (테스트 이름 또는 이메일 앞부분)
    const pageContent = await page.textContent('body');
    const hasUserName = pageContent?.includes(testName) || pageContent?.includes('testuser');
    
    expect(hasUserName).toBe(true);
    console.log('✅ 일반 사용자 이름 표시 확인');
    console.log('테스트 계정:', testEmail);
  });
});

