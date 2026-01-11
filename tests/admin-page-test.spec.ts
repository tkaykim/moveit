import { test, expect } from '@playwright/test';

test('admin page should load without errors', async ({ page }) => {
  // 오류를 콘솔에 기록
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // 페이지 오류를 캡처
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  // /admin 페이지로 이동
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });

  // 오류가 없는지 확인
  expect(errors.length).toBe(0);

  // 페이지가 로드되었는지 확인
  await expect(page.locator('text=관리자 대시보드')).toBeVisible({ timeout: 10000 });
});




