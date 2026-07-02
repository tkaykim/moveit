import { test, expect } from '@playwright/test';

test.describe('intro subscription funnel smoke', () => {
  test('guest can reach the start page and open auth before onboarding', async ({ page }) => {
    await page.goto('/intro');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('a[href*="/intro/start"]').first().click();
    await page.waitForURL(/\/intro\/start/);

    await page.getByRole('button', { name: /로그인.*회원가입|회원가입|로그인/ }).click();
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});

test.describe('mutating intro subscription funnel', () => {
  test.skip(process.env.RUN_MUTATING_E2E !== '1', 'Set RUN_MUTATING_E2E=1 only against an isolated test Supabase project.');

  test('signup, academy creation, and billing entry point are reachable', async ({ page }) => {
    test.setTimeout(90_000);

    const timestamp = Date.now();
    const testEmail = `e2e.${timestamp}@example.com`;
    const testPassword = 'e2etest123';
    const testName = 'E2E Test User';
    const academyName = `E2E Academy ${timestamp}`;

    await page.goto('/intro/start');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: /로그인.*회원가입|회원가입|로그인/ }).click();
    await page.getByRole('button', { name: /계정이 없으신가요|회원가입/ }).last().click();

    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('input[placeholder*="이름"]').fill(testName);
    await page.getByRole('button', { name: /^회원가입$/ }).click();

    await page.getByRole('link', { name: /학원 생성|학원 만들기/ }).click();
    await page.waitForURL(/\/intro\/setup-academy/);

    await page.locator('input[placeholder*="MOVEIT"], input[placeholder*="댄스학원"]').first().fill(academyName);
    await page.getByRole('button', { name: /학원 생성|생성하기/ }).click();

    await page.waitForURL(/\/academy-admin\/[^/]+/);
    await expect(page.getByText(/구독|결제|빌링|요금제/).first()).toBeVisible({ timeout: 15_000 });
  });
});
