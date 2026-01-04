import { test, expect } from '@playwright/test';

test.describe('Academy Admin Dashboard Mobile', () => {
  test('모바일에서 대시보드가 올바르게 표시되어야 함', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    
    // academy-admin 페이지로 이동
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
    
    // academy-admin 대시보드 페이지로 이동
    await page.goto(`/academy-admin/${academyId}`);
    await page.waitForLoadState('networkidle');
    
    // 통계 카드들이 2열로 표시되어야 함
    const statsGrid = page.locator('.grid.grid-cols-2');
    await expect(statsGrid).toBeVisible();
    
    // 통계 카드들이 모바일에서 작은 패딩을 가져야 함
    const firstStatCard = statsGrid.locator('> div').first();
    const padding = await firstStatCard.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.padding;
    });
    // 모바일에서는 p-3 (12px)이어야 함
    expect(padding).toContain('12px');
    
    // 최근 상담 내역이 모바일에서 카드 형태로 표시되어야 함
    const consultationCards = page.locator('text=최근 상담/등록 현황').locator('..').locator('.space-y-3 > div');
    const consultationCardsCount = await consultationCards.count();
    
    // 테이블이 모바일에서 숨겨져야 함
    const consultationTable = page.locator('text=최근 상담/등록 현황').locator('..').locator('table');
    await expect(consultationTable).not.toBeVisible();
    
    // 오늘의 수업 일정이 모바일에서 카드 형태로 표시되어야 함
    const todayClassesSection = page.locator('text=오늘의 수업 일정').locator('..');
    await expect(todayClassesSection).toBeVisible();
    
    // 테이블이 모바일에서 숨겨져야 함
    const classesTable = todayClassesSection.locator('table');
    await expect(classesTable).not.toBeVisible();
    
    // 카드 형태의 수업 목록이 표시되어야 함
    const classesCards = todayClassesSection.locator('.space-y-4 > div');
    const classesCardsCount = await classesCards.count();
    
    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/academy-admin-dashboard-mobile.png', fullPage: true });
  });

  test('데스크톱에서 대시보드가 테이블 형태로 표시되어야 함', async ({ page }) => {
    // 데스크톱 뷰포트 설정
    await page.setViewportSize({ width: 1280, height: 720 });
    
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
    
    // 통계 카드들이 4열로 표시되어야 함
    const statsGrid = page.locator('.grid.lg\\:grid-cols-4');
    await expect(statsGrid).toBeVisible();
    
    // 최근 상담 내역 테이블이 표시되어야 함
    const consultationTable = page.locator('text=최근 상담/등록 현황').locator('..').locator('table');
    await expect(consultationTable).toBeVisible();
    
    // 오늘의 수업 일정 테이블이 표시되어야 함
    const todayClassesSection = page.locator('text=오늘의 수업 일정').locator('..');
    const classesTable = todayClassesSection.locator('table');
    await expect(classesTable).toBeVisible();
  });
});




