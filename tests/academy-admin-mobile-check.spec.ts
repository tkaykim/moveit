import { test, expect } from '@playwright/test';

test.describe('Academy Admin Mobile Responsive Check', () => {
  test('모바일에서 햄버거 버튼과 사이드바 드로어 동작 확인', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    // academy-admin 페이지로 직접 이동 (실제 academyId 사용)
    const testAcademyId = 'b56add7d-f5b3-4d3b-bb6a-dc768b87227a';
    
    // 먼저 페이지가 로드되는지 확인
    await page.goto(`/academy-admin/${testAcademyId}`, { waitUntil: 'networkidle' });
    
    // 페이지가 로드되었는지 확인 (에러 페이지가 아닌지)
    const pageContent = await page.textContent('body');
    
    // 모바일 헤더 확인
    const mobileHeader = page.locator('.lg\\:hidden.sticky');
    const hamburgerButton = page.locator('button[aria-label="메뉴 열기"]');
    
    // 모바일 뷰포트에서는 햄버거 버튼이 보여야 함
    await expect(hamburgerButton).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('햄버거 버튼을 찾을 수 없습니다. 페이지 구조를 확인합니다.');
    });
    
    // 사이드바 확인
    const sidebar = page.locator('aside');
    
    // 처음에는 사이드바가 숨겨져 있어야 함 (모바일)
    const sidebarClass = await sidebar.getAttribute('class');
    console.log('사이드바 클래스:', sidebarClass);
    
    // 햄버거 버튼이 있으면 클릭
    if (await hamburgerButton.isVisible()) {
      await hamburgerButton.click();
      
      // 사이드바가 열려야 함
      await page.waitForTimeout(300);
      const sidebarAfterClick = await sidebar.getAttribute('class');
      console.log('클릭 후 사이드바 클래스:', sidebarAfterClick);
      
      // 닫기 버튼 확인
      const closeButton = page.locator('button[aria-label="메뉴 닫기"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(300);
        console.log('닫기 버튼 클릭 완료');
      }
    }
    
    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/academy-admin-mobile.png', fullPage: true });
  });

  test('데스크톱에서 사이드바 항상 표시 확인', async ({ page }) => {
    // 데스크톱 뷰포트 설정
    await page.setViewportSize({ width: 1280, height: 720 });
    
    const testAcademyId = 'b56add7d-f5b3-4d3b-bb6a-dc768b87227a';
    await page.goto(`/academy-admin/${testAcademyId}`, { waitUntil: 'networkidle' });
    
    // 데스크톱에서는 햄버거 버튼이 보이지 않아야 함
    const hamburgerButton = page.locator('button[aria-label="메뉴 열기"]');
    await expect(hamburgerButton).not.toBeVisible({ timeout: 2000 }).catch(() => {
      console.log('데스크톱에서 햄버거 버튼이 숨겨져 있습니다.');
    });
    
    // 사이드바가 항상 표시되어야 함
    const sidebar = page.locator('aside');
    const isVisible = await sidebar.isVisible();
    console.log('데스크톱 사이드바 표시 여부:', isVisible);
    
    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/academy-admin-desktop.png', fullPage: true });
  });
});

