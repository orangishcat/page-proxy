import {test, expect} from '@playwright/test';
import {parseScriptMetadata} from '../src/lib/utils/script-metadata';

test('parses title and website from script metadata', () => {
  const script = `// ==Page Proxy==\n// @title Steam redesign\n// @website https://store.steampowered.com\n// ==/Page Proxy==`;
  const metadata = parseScriptMetadata(script);
  expect(metadata).not.toBeNull();
  expect(metadata?.title).toBe('Steam redesign');
  expect(metadata?.website).toBe('https://store.steampowered.com');
});

test('accepts flexible spacing and colon separators', () => {
  const script = `// ==  Page   Proxy  ==\n// @title: Another title\n// @website: https://example.com\n// == / Page Proxy ==`;
  const metadata = parseScriptMetadata(script);
  expect(metadata).not.toBeNull();
  expect(metadata?.title).toBe('Another title');
  expect(metadata?.website).toBe('https://example.com');
});
