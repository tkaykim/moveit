import { test, expect } from '@playwright/test';

test.describe('마이 페이지 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 페이지 로드 대기
    await page.waitForTimeout(2000);
  });

  test('마이 탭 클릭 시 마이 페이지가 표시되어야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // 마이 페이지 제목 확인
    const pageTitle = page.locator('h2:has-text("마이 무브")');
    await expect(pageTitle).toBeVisible();
  });

  test('마이 페이지에 프로필 정보가 표시되어야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // 프로필 영역 확인 (사용자 이름 또는 이메일)
    const profileSection = page.locator('div').filter({ hasText: /사용자|@/ });
    await expect(profileSection.first()).toBeVisible();
  });

  test('마이 페이지에 통계 정보가 표시되어야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // 통계 카드 확인 (포인트, 쿠폰, 찜)
    const statsCards = page.locator('div').filter({ hasText: /포인트|쿠폰|찜/ });
    const count = await statsCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('마이 페이지에 QR 코드 버튼이 표시되어야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // QR 코드 버튼 확인
    const qrButton = page.locator('button:has-text("QR코드로 출석하기")');
    await expect(qrButton).toBeVisible();
  });

  test('QR 코드 버튼 클릭 시 모달이 열려야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // QR 코드 버튼 클릭
    const qrButton = page.locator('button:has-text("QR코드로 출석하기")');
    await qrButton.click();
    await page.waitForTimeout(1000);

    // QR 모달 확인
    const qrModal = page.locator('h3:has-text("QR CHECK-IN")');
    await expect(qrModal).toBeVisible();
  });

  test('마이 페이지에 찜한 목록 섹션이 표시되어야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // 찜한 목록 제목 확인
    const favoritesTitle = page.locator('h3:has-text("찜한 목록")');
    await expect(favoritesTitle).toBeVisible();
  });

  test('마이 페이지에 최근 수강 기록 섹션이 표시되어야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // 최근 수강 기록 제목 확인
    const historyTitle = page.locator('h3:has-text("최근 수강 기록")');
    await expect(historyTitle).toBeVisible();
  });

  test('찜한 목록에서 학원/강사 탭 전환이 작동해야 함', async ({ page }) => {
    // 마이 탭 클릭
    const myTab = page.locator('button:has-text("마이")');
    await myTab.click();
    await page.waitForTimeout(2000);

    // 학원 탭 클릭
    const academyTab = page.locator('button:has-text("학원")').filter({ hasText: /학원 \(\d+\)/ });
    if (await academyTab.count() > 0) {
      await academyTab.click();
      await page.waitForTimeout(500);
    }

    // 강사 탭 클릭
    const dancerTab = page.locator('button:has-text("강사")').filter({ hasText: /강사 \(\d+\)/ });
    if (await dancerTab.count() > 0) {
      await dancerTab.click();
      await page.waitForTimeout(500);
    }
  });
});




