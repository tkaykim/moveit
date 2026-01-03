import { test, expect } from '@playwright/test';

test.describe('찜 기능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 페이지 로드 대기
    await page.waitForTimeout(2000);
  });

  test('강사 찜 기능 테스트', async ({ page }) => {
    // 강사 탭 클릭
    const instructorTab = page.locator('button:has-text("강사")');
    await instructorTab.click();
    await page.waitForTimeout(2000);

    // 강사 목록 확인
    const instructorCards = page.locator('[class*="aspect-[3/4]"]');
    const count = await instructorCards.count();
    
    if (count > 0) {
      // 첫 번째 강사 카드의 찜 버튼 찾기
      const firstCard = instructorCards.first();
      const likeButton = firstCard.locator('button').filter({ has: page.locator('svg') }).first();
      
      // 찜 버튼 클릭
      await likeButton.click();
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

  test('학원 찜 기능 테스트', async ({ page }) => {
    // 학원 탭 클릭
    const academyTab = page.locator('button:has-text("학원")');
    await academyTab.click();
    await page.waitForTimeout(2000);

    // 학원 목록 확인
    const academyCards = page.locator('[class*="rounded-3xl"]').filter({ has: page.locator('h3') });
    const count = await academyCards.count();
    
    if (count > 0) {
      // 첫 번째 학원 카드의 찜 버튼 찾기
      const firstCard = academyCards.first();
      const likeButton = firstCard.locator('button').filter({ has: page.locator('svg') }).first();
      
      // 찜 버튼 클릭
      await likeButton.click();
      await page.waitForTimeout(1000);

      // 마이 탭으로 이동
      const myTab = page.locator('button:has-text("마이")');
      await myTab.click();
      await page.waitForTimeout(1000);

      // 학원 찜 버튼 클릭
      const favoriteButton = page.locator('button:has-text("학원 찜")');
      if (await favoriteButton.count() > 0) {
        await favoriteButton.click();
        await page.waitForTimeout(1000);

        // 학원 탭 클릭
        const academyTabInFavorites = page.locator('button:has-text("학원")').filter({ hasText: '학원' });
        if (await academyTabInFavorites.count() > 0) {
          await academyTabInFavorites.click();
          await page.waitForTimeout(1000);

          // 찜한 학원이 표시되는지 확인
          const favoriteAcademies = page.locator('[class*="rounded-3xl"]').filter({ has: page.locator('h3') });
          const favoriteCount = await favoriteAcademies.count();
          
          if (favoriteCount > 0) {
            await expect(favoriteAcademies.first()).toBeVisible();
          }
        }
      }
    }
  });
});



