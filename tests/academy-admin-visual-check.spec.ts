import { test, expect } from '@playwright/test';

test.describe('Academy Admin Visual Check', () => {
  const academyId = 'b56add7d-f5b3-4d3b-bb6a-dc768b87227a';

  test('모바일 뷰포트에서 페이지 구조 확인', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`http://localhost:3000/academy-admin/${academyId}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    // 페이지가 로드되었는지 확인
    await page.waitForTimeout(2000);
    
    // 페이지의 모든 요소 확인
    const bodyText = await page.textContent('body');
    console.log('페이지 내용:', bodyText?.substring(0, 200));
    
    // HTML 구조 확인
    const html = await page.content();
    console.log('HTML 구조 확인:', html.substring(0, 500));
    
    // 스크린샷 저장
    await page.screenshot({ 
      path: 'test-results/academy-admin-mobile-visual.png', 
      fullPage: true 
    });
    
    // 햄버거 버튼 찾기 (여러 방법으로 시도)
    const hamburgerByAria = page.locator('button[aria-label="메뉴 열기"]');
    const hamburgerByMenu = page.locator('button').filter({ has: page.locator('svg') });
    const hamburgerByClass = page.locator('.lg\\:hidden button');
    
    console.log('햄버거 버튼 (aria-label):', await hamburgerByAria.count());
    console.log('햄버거 버튼 (menu icon):', await hamburgerByMenu.count());
    console.log('햄버거 버튼 (class):', await hamburgerByClass.count());
    
    // 사이드바 찾기
    const sidebar = page.locator('aside');
    console.log('사이드바 개수:', await sidebar.count());
    
    if (await sidebar.count() > 0) {
      const sidebarClass = await sidebar.first().getAttribute('class');
      console.log('사이드바 클래스:', sidebarClass);
      const isVisible = await sidebar.first().isVisible();
      console.log('사이드바 표시 여부:', isVisible);
    }
  });

  test('데스크톱 뷰포트에서 페이지 구조 확인', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    
    await page.goto(`http://localhost:3000/academy-admin/${academyId}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    await page.waitForTimeout(2000);
    
    // 스크린샷 저장
    await page.screenshot({ 
      path: 'test-results/academy-admin-desktop-visual.png', 
      fullPage: true 
    });
    
    // 사이드바 확인
    const sidebar = page.locator('aside');
    console.log('데스크톱 사이드바 개수:', await sidebar.count());
    
    if (await sidebar.count() > 0) {
      const sidebarClass = await sidebar.first().getAttribute('class');
      console.log('데스크톱 사이드바 클래스:', sidebarClass);
      const isVisible = await sidebar.first().isVisible();
      console.log('데스크톱 사이드바 표시 여부:', isVisible);
    }
    
    // 햄버거 버튼이 숨겨져 있는지 확인
    const hamburger = page.locator('button[aria-label="메뉴 열기"]');
    const isHamburgerVisible = await hamburger.isVisible();
    console.log('데스크톱 햄버거 버튼 표시 여부:', isHamburgerVisible);
  });
});

