import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure' },
  projects: [{ name: 'mobile-chrome', use: devices['Pixel 7'] }],
  webServer: {
    command: 'pnpm dev --port 3010',
    url: 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
  },
})
