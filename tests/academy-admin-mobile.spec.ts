import { test, expect } from '@playwright/test';

test.describe('Academy Admin Mobile Responsive', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트용 academyId (실제 DB에 있는 ID로 변경 필요)
    // 일단 첫 번째 academy를 가져오거나 기본값 사용
  });

  test('모바일에서 햄버거 버튼이 표시되고 사이드바가 드로어로 작동해야 함', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    // academy-admin 페이지로 이동 (실제 academyId 필요)
    // 먼저 academies 목록을 가져와서 첫 번째 academyId 사용
    await page.goto('/admin/academies');
    await page.waitForLoadState('networkidle');
    
    // academies 테이블에서 첫 번째 academy ID 가져오기
    const firstAcademyLink = page.locator('table tbody tr').first().locator('a').first();
    const academyHref = await firstAcademyLink.getAttribute('href');
    
    if (!academyHref) {
      test.skip();
      return;
    }
    
    const academyId = academyHref.split('/').pop();
    if (!academyId) {
      test.skip();
      return;
    }
    
    // academy-admin 페이지로 이동
    await page.goto(`/academy-admin/${academyId}`);
    await page.waitForLoadState('networkidle');
    
    // 모바일 헤더에서 햄버거 버튼 확인
    const hamburgerButton = page.locator('button[aria-label="메뉴 열기"]');
    await expect(hamburgerButton).toBeVisible();
    
    // 사이드바가 처음에는 숨겨져 있어야 함
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveClass(/translate-x-full/);
    
    // 햄버거 버튼 클릭
    await hamburgerButton.click();
    
    // 사이드바가 열려야 함
    await expect(sidebar).not.toHaveClass(/translate-x-full/);
    
    // 오버레이가 표시되어야 함
    const overlay = page.locator('.fixed.inset-0.bg-black\\/50');
    await expect(overlay).toBeVisible();
    
    // 닫기 버튼 확인
    const closeButton = page.locator('button[aria-label="메뉴 닫기"]');
    await expect(closeButton).toBeVisible();
    
    // 닫기 버튼 클릭
    await closeButton.click();
    
    // 사이드바가 다시 숨겨져야 함
    await expect(sidebar).toHaveClass(/translate-x-full/);
  });

  test('데스크톱에서 사이드바가 항상 표시되어야 함', async ({ page }) => {
    // 데스크톱 뷰포트 설정
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // academy-admin 페이지로 이동
    await page.goto('/admin/academies');
    await page.waitForLoadState('networkidle');
    
    const firstAcademyLink = page.locator('table tbody tr').first().locator('a').first();
    const academyHref = await firstAcademyLink.getAttribute('href');
    
    if (!academyHref) {
      test.skip();
      return;
    }
    
    const academyId = academyHref.split('/').pop();
    if (!academyId) {
      test.skip();
      return;
    }
    
    await page.goto(`/academy-admin/${academyId}`);
    await page.waitForLoadState('networkidle');
    
    // 데스크톱에서는 햄버거 버튼이 보이지 않아야 함
    const hamburgerButton = page.locator('button[aria-label="메뉴 열기"]');
    await expect(hamburgerButton).not.toBeVisible();
    
    // 사이드바가 항상 표시되어야 함
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveClass(/translate-x-full/);
  });

  test('모바일에서 메뉴 항목 클릭 시 드로어가 닫혀야 함', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/admin/academies');
    await page.waitForLoadState('networkidle');
    
    const firstAcademyLink = page.locator('table tbody tr').first().locator('a').first();
    const academyHref = await firstAcademyLink.getAttribute('href');
    
    if (!academyHref) {
      test.skip();
      return;
    }
    
    const academyId = academyHref.split('/').pop();
    if (!academyId) {
      test.skip();
      return;
    }
    
    await page.goto(`/academy-admin/${academyId}`);
    await page.waitForLoadState('networkidle');
    
    // 햄버거 버튼 클릭하여 사이드바 열기
    const hamburgerButton = page.locator('button[aria-label="메뉴 열기"]');
    await hamburgerButton.click();
    
    // 사이드바가 열렸는지 확인
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toHaveClass(/translate-x-full/);
    
    // 메뉴 항목 클릭 (예: 학생 관리)
    const studentsLink = page.locator('a').filter({ hasText: '학생 관리' }).first();
    if (await studentsLink.isVisible()) {
      await studentsLink.click();
      
      // 사이드바가 닫혀야 함
      await expect(sidebar).toHaveClass(/translate-x-full/);
    }
  });
});




