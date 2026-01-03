import { test, expect } from '@playwright/test';

test.describe('일정 탭 (Calendar View)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('일정 탭으로 이동할 수 있어야 함', async ({ page }) => {
    // 하단 네비게이션에서 일정 탭 클릭
    const savedTab = page.locator('text=일정').or(page.locator('[data-testid="saved-tab"]'));
    await savedTab.click();
    
    // 일정 탭이 표시되는지 확인
    await expect(page.locator('text=클래스 일정')).toBeVisible();
  });

  test('클래스 정보가 제대로 로드되어야 함', async ({ page }) => {
    // 일정 탭으로 이동
    const savedTab = page.locator('text=일정').or(page.locator('[data-testid="saved-tab"]'));
    await savedTab.click();
    
    // 로딩 완료 대기
    await page.waitForTimeout(2000);
    
    // 클래스 정보가 표시되는지 확인 (데이터가 있는 경우)
    const classList = page.locator('text=이번 주 클래스가 없습니다').or(
      page.locator('.bg-white, .bg-neutral-900').filter({ hasText: /클래스|원/ })
    );
    
    // 클래스가 있거나 없음을 확인 (둘 다 정상)
    const hasClasses = await classList.count() > 0;
    const hasNoClasses = await page.locator('text=이번 주 클래스가 없습니다').isVisible().catch(() => false);
    
    expect(hasClasses || hasNoClasses).toBeTruthy();
  });

  test('주간 네비게이션이 작동해야 함', async ({ page }) => {
    // 일정 탭으로 이동
    const savedTab = page.locator('text=일정').or(page.locator('[data-testid="saved-tab"]'));
    await savedTab.click();
    
    await page.waitForTimeout(1000);
    
    // 이전 주 버튼 클릭
    const prevButton = page.locator('button').filter({ has: page.locator('svg') }).first();
    await prevButton.click();
    
    await page.waitForTimeout(500);
    
    // 다음 주 버튼 클릭
    const nextButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    await nextButton.click();
    
    await page.waitForTimeout(500);
    
    // 오늘 버튼 클릭
    const todayButton = page.locator('text=오늘');
    await todayButton.click();
    
    await page.waitForTimeout(500);
    
    // 페이지가 정상적으로 로드되었는지 확인
    await expect(page.locator('text=클래스 일정')).toBeVisible();
  });

  test('요일 선택 버튼이 작동해야 함', async ({ page }) => {
    // 일정 탭으로 이동
    const savedTab = page.locator('text=일정').or(page.locator('[data-testid="saved-tab"]'));
    await savedTab.click();
    
    await page.waitForTimeout(1000);
    
    // 요일 버튼 중 하나 클릭 (월요일)
    const mondayButton = page.locator('button').filter({ hasText: '월' }).first();
    if (await mondayButton.isVisible()) {
      await mondayButton.click();
      await page.waitForTimeout(500);
    }
    
    // 페이지가 정상적으로 로드되었는지 확인
    await expect(page.locator('text=클래스 일정')).toBeVisible();
  });
});

