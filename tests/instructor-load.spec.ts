import { test, expect } from '@playwright/test';

test.describe('강사 로드 테스트', () => {
  test('강사 목록이 제대로 로드되는지 확인', async ({ page, browserName }) => {
    // 브라우저 콘솔 에러 수집
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('http://localhost:3000');
    
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 강사 탭 클릭 - 더 구체적인 셀렉터 사용
    const instructorTab = page.locator('nav button').filter({ hasText: '강사' }).last();
    await instructorTab.click();
    
    // 강사 목록이 로드될 때까지 대기
    await page.waitForTimeout(3000);

    // INSTRUCTORS 제목 확인
    const title = page.locator('h2:has-text("INSTRUCTORS")');
    await expect(title).toBeVisible({ timeout: 5000 });

    // 강사 카드 확인
    const instructorCards = page.locator('[class*="aspect-[3/4]"]');
    const count = await instructorCards.count();
    
    console.log(`강사 카드 개수: ${count}`);
    console.log(`콘솔 에러: ${errors.join(', ')}`);

    // 스크린샷 저장
    await page.screenshot({ path: `test-results/instructor-load-${browserName}.png`, fullPage: true });

    // 강사가 있으면 첫 번째 카드 확인
    if (count > 0) {
      await expect(instructorCards.first()).toBeVisible();
      console.log('✅ 강사 목록이 정상적으로 로드되었습니다.');
    } else {
      console.log('⚠️ 강사 목록이 비어있습니다.');
      // 에러 메시지 확인
      const errorMessage = page.locator('text=등록된 강사가 없습니다');
      if (await errorMessage.count() > 0) {
        console.log('⚠️ "등록된 강사가 없습니다" 메시지가 표시되었습니다.');
      }
    }

    // 콘솔 에러가 있으면 출력
    if (errors.length > 0) {
      console.error('콘솔 에러:', errors);
    }
  });
});


