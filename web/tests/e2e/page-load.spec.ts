import {test, expect} from '@playwright/test';

test('loads landing page without page or console errors', async ({page}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Customization at your fingertips.'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Install'}).first()).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('landing demo advances to the saved state and loops back to the start', async ({page}) => {
  await page.goto('/');
  const demo = page.getByTestId('landing-demo');

  await expect(demo).toBeVisible();
  await expect(demo).toHaveAttribute('data-demo-step', 'initial');

  await expect(demo).toHaveAttribute('data-demo-step', 'saved', {timeout: 20_000});
  await expect(demo).toHaveAttribute('data-demo-step', 'initial', {timeout: 20_000});
});

test('landing demo tabs jump to the requested animation sections', async ({page}) => {
  await page.goto('/');
  const demo = page.getByTestId('landing-demo');

  await expect(demo).toHaveAttribute('data-demo-ready', 'true');

  await page.getByTestId('hero-tab-record').click();
  await expect(demo).toHaveAttribute('data-demo-step', 'record-tool');

  await page.getByTestId('hero-tab-save-code').click();
  await expect(demo).toHaveAttribute('data-demo-step', 'convert-code');
});
