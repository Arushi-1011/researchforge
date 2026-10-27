import { test, expect } from '@playwright/test';

test.describe('ResearchForge End-to-End Workflow', () => {
  test('authenticates, navigates workspaces, and executes quantitative analytics', async ({ page }) => {
    // 1. Visit application root
    await page.goto('/');

    // 2. Verify branding and title
    await expect(page).toHaveTitle(/ResearchForge/i);
    await expect(page.getByText('Rigorous research.')).toBeVisible();

    // 3. One-click demo authentication
    const demoButton = page.getByRole('button', { name: /Guest Demo/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // 4. Verify successful authentication and landing on Overview
    await expect(page.getByRole('heading', { name: /Research Overview/i })).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Quantitative Analytics page
    await page.getByRole('button', { name: /Analytics/i }).click();
    await expect(page.getByRole('heading', { name: /Research Analytics/i })).toBeVisible();

    // 6. Verify analytical elements rendered
    await expect(page.getByText(/Quantitative portfolio analysis/i)).toBeVisible();
  });
});
