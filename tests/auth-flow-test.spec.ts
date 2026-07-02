import { test, expect } from '@playwright/test';

async function openMemberAuthModal(page: any) {
  await page.goto('/my');
  await page.waitForLoadState('domcontentloaded');

  const loginButton = page.getByRole('button', { name: /로그인하세요|로그인하기|로그인/ }).first();
  await expect(loginButton).toBeVisible({ timeout: 15_000 });
  await loginButton.click();

  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
}

test.describe('member auth flow smoke', () => {
  test('guest can open the login modal from My page', async ({ page }) => {
    await openMemberAuthModal(page);

    await expect(page.getByRole('button', { name: /^로그인$/ }).first()).toBeVisible();
  });

  test('guest can switch to the signup form without submitting it', async ({ page }) => {
    await openMemberAuthModal(page);

    await page.getByRole('button', { name: /계정이 없으신가요|회원가입/ }).last().click();

    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="이름"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^회원가입$/ }).first()).toBeVisible();
  });

  test('anonymous QR generation is rejected by the API', async ({ request }) => {
    const response = await request.post('/api/attendance/qr-generate', {
      data: { bookingId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.status()).toBe(401);
  });

  test('anonymous booking creation cannot create a paid reservation', async ({ request }) => {
    const response = await request.post('/api/bookings', {
      data: {
        scheduleId: '00000000-0000-0000-0000-000000000000',
        userId: '00000000-0000-0000-0000-000000000000',
        paymentMethod: 'card',
      },
    });

    expect([400, 401]).toContain(response.status());
  });
});
