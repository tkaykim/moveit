import { test, expect } from '@playwright/test';

test.describe('마이 페이지 간단한 인증 최종 테스트', () => {
  test('비로그인 상태 - "로그인하세요" 표시', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=로그인하세요')).toBeVisible();
    console.log('✅ 비로그인 상태 확인 완료');
  });
  
  test('admin 계정 로그인 - 실제 이름 표시', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    await page.fill('input[type="password"]', '123123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*\/(admin|$)/, { timeout: 10000 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.click('text=마이');
    await page.waitForLoadState('networkidle');
    
    // 사용자 이름 확인
    const userNameElement = page.locator('[data-testid="user-name"]');
    const userName = await userNameElement.textContent();
    
    expect(userName).not.toBe('사용자');
    expect(userName?.trim().length).toBeGreaterThan(0);
    
    console.log('✅ Admin 계정 이름 표시 확인:', userName);
  });
});

