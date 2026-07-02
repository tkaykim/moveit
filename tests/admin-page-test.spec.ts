import { test, expect } from '@playwright/test';

test('admin page does not expose dashboard data to an anonymous visitor', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/admin');
  await page.waitForLoadState('domcontentloaded');

  await expect(
    page.getByText(/관리자 페이지에 접근하려면|로그인이 필요합니다|최고관리자 계정/)
  ).toBeVisible({ timeout: 15_000 });
  expect(runtimeErrors).toEqual([]);
});
