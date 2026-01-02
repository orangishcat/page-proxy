import {test, expect} from '@playwright/test';

const metadataScript = `// ==Page Proxy==\n// @title Steam redesign\n// @website https://store.steampowered.com\n// ==/Page Proxy==`;

test('loads project page from local storage without errors', async ({page}) => {
  const baseId = 'Steam redesign.js';
  const storageKey = `file_${baseId}`;
  const encodedId = encodeURIComponent(`file://${baseId}`);
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

  await page.addInitScript(
    ({key, value}) => {
      localStorage.setItem(key, value);
    },
    {key: storageKey, value: metadataScript}
  );

  await page.goto(`/app/project/${encodedId}`);
  await expect(page.getByText('Tool info')).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
