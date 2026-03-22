import {test, expect} from '@playwright/test';

const getDemoCursorMetrics = (page: Parameters<typeof test>[0]['page']) =>
  page.evaluate(() => {
    const demo = document.querySelector<HTMLElement>('[data-testid="landing-demo"]');
    const toolPanel = document.querySelector<HTMLElement>('[aria-label="Landing demo tool panel"]');
    const cursorIcon = demo?.querySelector<SVGSVGElement>('.lucide-navigation');
    const cursor = cursorIcon?.parentElement;

    if (!demo || !toolPanel || !cursor) {
      throw new Error('Landing demo elements were not found.');
    }

    const demoRect = demo.getBoundingClientRect();
    const toolRect = toolPanel.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();

    return {
      cursorOffsetX: cursorRect.left - demoRect.left,
      cursorOffsetY: cursorRect.top - demoRect.top,
      targetOffsetX: toolRect.left - demoRect.left + toolRect.width * 0.5,
      targetOffsetY: toolRect.top - demoRect.top + toolRect.height * 0.89,
    };
  });

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

test('landing demo recalculates cursor coordinates after resize', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1200});
  await page.goto('/');
  const demo = page.getByTestId('landing-demo');

  await expect(demo).toHaveAttribute('data-demo-ready', 'true');
  await page.getByTestId('hero-tab-save-code').click();
  await expect(demo).toHaveAttribute('data-demo-step', 'convert-code');

  const beforeResize = await getDemoCursorMetrics(page);

  await page.setViewportSize({width: 960, height: 900});
  await page.waitForTimeout(50);

  const afterResize = await getDemoCursorMetrics(page);
  const cursorDeltaX = afterResize.cursorOffsetX - beforeResize.cursorOffsetX;
  const cursorDeltaY = afterResize.cursorOffsetY - beforeResize.cursorOffsetY;
  const targetDeltaX = afterResize.targetOffsetX - beforeResize.targetOffsetX;
  const targetDeltaY = afterResize.targetOffsetY - beforeResize.targetOffsetY;

  expect(Math.abs(cursorDeltaX - targetDeltaX)).toBeLessThan(6);
  expect(Math.abs(cursorDeltaY - targetDeltaY)).toBeLessThan(6);
});
