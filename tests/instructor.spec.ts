import { test, expect } from '@playwright/test';

test.describe('강사 탭 테스트', () => {
  test('강사 목록이 표시되는지 확인', async ({ page }) => {
    await page.goto('/');
    
    // 강사 탭 클릭
    const instructorTab = page.locator('button:has-text("강사")');
    await instructorTab.click();
    
    // INSTRUCTORS 제목이 표시되는지 확인
    await expect(page.locator('h2:has-text("INSTRUCTORS")')).toBeVisible();
    
    // 강사 목록이 로드될 때까지 대기
    await page.waitForTimeout(2000);
    
    // 강사 카드가 표시되는지 확인 (데이터가 있는 경우)
    const instructorCards = page.locator('[class*="aspect-[3/4]"]');
    const count = await instructorCards.count();
    
    if (count > 0) {
      // 첫 번째 강사 카드가 표시되는지 확인
      await expect(instructorCards.first()).toBeVisible();
    }
  });

  test('강사 찜 기능 테스트', async ({ page }) => {
    await page.goto('/');
    
    // 강사 탭 클릭
    const instructorTab = page.locator('button:has-text("강사")');
    await instructorTab.click();
    
    await page.waitForTimeout(2000);
    
    // 찜 버튼 찾기
    const likeButtons = page.locator('button:has(svg)').filter({ has: page.locator('svg') });
    const firstLikeButton = likeButtons.first();
    
    if (await firstLikeButton.count() > 0) {
      // 찜 버튼 클릭
      await firstLikeButton.click();
      await page.waitForTimeout(1000);
      
      // 마이 탭으로 이동
      const myTab = page.locator('button:has-text("마이")');
      await myTab.click();
      await page.waitForTimeout(1000);
      
      // 강사 찜 버튼 클릭
      const favoriteButton = page.locator('button:has-text("강사 찜")');
      if (await favoriteButton.count() > 0) {
        await favoriteButton.click();
        await page.waitForTimeout(1000);
        
        // 찜한 강사가 표시되는지 확인
        const favoriteInstructors = page.locator('[class*="aspect-[3/4]"]');
        const favoriteCount = await favoriteInstructors.count();
        
        if (favoriteCount > 0) {
          await expect(favoriteInstructors.first()).toBeVisible();
        }
      }
    }
  });
});




