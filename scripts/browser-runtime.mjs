// Optional release tooling reuses the existing local Playwright installation.
// It is not part of the app bundle or the dependency-free unit tests.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(new URL('../.checks/package.json', import.meta.url));
export const { chromium } = require('playwright-core');
export const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const releaseUrl = process.env.RELEASE_URL || 'http://127.0.0.1:4173/nawras-memory/';
await mkdir('.checks', { recursive: true });
