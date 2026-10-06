import { defineConfig, devices } from "@playwright/test";

/**
 * Testy e2e na pełnym lokalnym stacku Supabase (`npx supabase start`) + Vite dev.
 * Wymagania: działający Supabase lokalnie, `.env.local` z VITE_SUPABASE_URL/KEY wskazującymi na niego,
 * sekrety funkcji w `supabase/functions/.env.local` (patrz e2e/README.md).
 */
const PORT = Number(process.env.E2E_PORT ?? 8080);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
