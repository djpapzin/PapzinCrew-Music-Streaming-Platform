import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_FRONTEND_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
