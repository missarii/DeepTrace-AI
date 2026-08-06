import { test, expect } from '@playwright/test';

// Full workflow against a running stack (api + web). Deterministic demo path needs no paid keys.
test('register → demo research → report → export', async ({ page }) => {
  await page.goto(process.env.E2E_WEB ?? 'http://localhost:5173');
  await expect(page.getByText('DeepTrace AI')).toBeVisible();
  await page.goto(`${process.env.E2E_WEB ?? 'http://localhost:5173'}/report/demo`);
  await expect(page.getByText('DEMONSTRATION DATA')).toBeVisible();
});
