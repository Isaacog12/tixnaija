import { test, expect } from '@playwright/test';

test('homepage has TixNaija title and branding', async ({ page }) => {
  const targetUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://tixnaija.name.ng/';
  await page.goto(targetUrl);

  // Expect page to have TixNaija in title
  await expect(page).toHaveTitle(/TixNaija/i);
});

test('browse page is navigable', async ({ page }) => {
  const targetUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://tixnaija.name.ng/browse';
  await page.goto(targetUrl);

  await expect(page.locator('body')).toBeVisible();
});
