import { test, expect } from '@playwright/test';

test.describe('마이 페이지 인증 테스트', () => {
  test('로그인되지 않은 상태에서 마이 페이지 접근', async ({ page }) => {
    // 먼저 로그아웃 상태로 만들기
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    
    // 마이 페이지로 이동
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // 로그인 안내 메시지 확인
    await expect(page.locator('text=로그인이 필요합니다')).toBeVisible();
    await expect(page.locator('text=로그인하기')).toBeVisible();
    
    console.log('✅ 비로그인 상태 UI 확인 완료');
  });
  
  test('로그인된 상태에서 마이 페이지 접근', async ({ page }) => {
    // 로그인
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    await page.fill('input[type="password"]', '123123');
    await page.click('button[type="submit"]');
    
    // 로그인 후 홈으로 리다이렉트 대기
    await page.waitForURL(/.*\/(admin|$)/, { timeout: 10000 });
    
    // 홈 페이지로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 마이 탭 클릭
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // 사용자 정보 확인
    const userName = await page.locator('text=김현준, text=사용자').first().textContent().catch(() => null);
    const userEmail = await page.locator('text=tommy0621@naver.com').textContent().catch(() => null);
    
    console.log('사용자 이름:', userName);
    console.log('사용자 이메일:', userEmail);
    
    // 로그아웃 버튼 확인
    const logoutButton = page.locator('button[title="로그아웃"]');
    await expect(logoutButton).toBeVisible();
    
    console.log('✅ 로그인 상태 UI 확인 완료');
  });
  
  test('로그아웃 기능 테스트', async ({ page }) => {
    // 먼저 로그인
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    await page.fill('input[type="password"]', '123123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*\/(admin|$)/, { timeout: 10000 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 마이 탭 클릭
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // 로그아웃 버튼 클릭
    const logoutButton = page.locator('button[title="로그아웃"]');
    await logoutButton.click();
    
    // 확인 다이얼로그 처리
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // 로그아웃 후 로그인 안내 메시지 확인
    await page.waitForTimeout(1000);
    await expect(page.locator('text=로그인이 필요합니다')).toBeVisible({ timeout: 5000 });
    
    console.log('✅ 로그아웃 기능 확인 완료');
  });
});

