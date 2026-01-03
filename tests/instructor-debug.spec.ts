import { test, expect } from '@playwright/test';

test.describe('강사 로드 디버깅', () => {
  test('강사 탭 클릭 및 로드 확인', async ({ page, browserName }) => {
    // 브라우저 콘솔 로그 수집
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });

    // 네트워크 요청 모니터링
    const networkRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('supabase') || request.url().includes('instructors')) {
        networkRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    page.on('response', response => {
      if (response.url().includes('supabase') || response.url().includes('instructors')) {
        networkRequests.push(`→ ${response.status()} ${response.url()}`);
      }
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 페이지 HTML 확인
    const pageContent = await page.content();
    console.log('페이지 로드 완료');

    // 하단 네비게이션 확인
    const nav = page.locator('nav').last();
    const navVisible = await nav.isVisible();
    console.log(`하단 네비게이션 표시: ${navVisible}`);

    // 강사 탭 찾기 - 여러 방법 시도
    let instructorTab = null;
    
    // 방법 1: 정확한 텍스트로 찾기
    instructorTab = page.locator('button').filter({ hasText: /^강사$/ });
    const count1 = await instructorTab.count();
    console.log(`방법 1 - 정확한 텍스트 "강사": ${count1}개`);

    // 방법 2: 하단 네비게이션 내에서 찾기
    instructorTab = nav.locator('button').filter({ hasText: '강사' });
    const count2 = await instructorTab.count();
    console.log(`방법 2 - 네비게이션 내 "강사": ${count2}개`);

    // 방법 3: 모든 버튼 확인
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`전체 버튼 개수: ${buttonCount}`);
    
    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();
      if (text && text.includes('강사')) {
        console.log(`버튼 ${i}: "${text}"`);
      }
    }

    // 강사 탭 클릭 시도
    if (count2 > 0) {
      await instructorTab.last().click();
      await page.waitForTimeout(3000);

      // INSTRUCTORS 제목 확인
      const title = page.locator('h2').filter({ hasText: 'INSTRUCTORS' });
      const titleVisible = await title.isVisible().catch(() => false);
      console.log(`INSTRUCTORS 제목 표시: ${titleVisible}`);

      // 강사 카드 확인
      const instructorCards = page.locator('[class*="aspect-[3/4]"]');
      const cardCount = await instructorCards.count();
      console.log(`강사 카드 개수: ${cardCount}`);

      // 에러 메시지 확인
      const errorMessage = page.locator('text=등록된 강사가 없습니다');
      const hasErrorMessage = await errorMessage.isVisible().catch(() => false);
      console.log(`에러 메시지 표시: ${hasErrorMessage}`);

      // 콘솔 에러 출력
      if (consoleErrors.length > 0) {
        console.log('콘솔 에러:');
        consoleErrors.forEach(err => console.log(`  - ${err}`));
      }

      // 네트워크 요청 출력
      if (networkRequests.length > 0) {
        console.log('네트워크 요청:');
        networkRequests.forEach(req => console.log(`  - ${req}`));
      }

      // 스크린샷 저장
      await page.screenshot({ 
        path: `test-results/instructor-debug-${browserName}.png`, 
        fullPage: true 
      });
    } else {
      console.log('⚠️ 강사 탭을 찾을 수 없습니다.');
      await page.screenshot({ 
        path: `test-results/instructor-tab-not-found-${browserName}.png`, 
        fullPage: true 
      });
    }
  });
});



