import { test, expect } from "@playwright/test";
import { createUser, getProduct, login, prepareContext, uniqueEmail, updateProfile } from "./helpers";

test.beforeEach(async ({ context }) => {
  await prepareContext(context);
});

test("admin: dashboard, synchronizacja hurtowni mock, lista zamówień", async ({ page }) => {
  const email = uniqueEmail("admin");
  const password = "Admin-Testowy-123";
  const id = await createUser(email, password, "Admin Testowy");
  await updateProfile(id, { role: "admin" });

  await login(page, email, password);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/Zamówienia dziś/i).first()).toBeVisible();

  await page.goto("/admin/hurtownie");
  const mockCard = page.locator("div").filter({ hasText: /Hurtownia demo \(mock\)/ }).filter({ has: page.getByRole("button", { name: /Synchronizuj teraz/ }) }).last();
  await mockCard.getByRole("button", { name: /Synchronizuj teraz/ }).click();
  await expect(page.getByText(/Zsynchronizowano \d+ pozycji/).first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/zamowienia");
  await expect(page.getByText(/ZAM\/\d{4}\/\d{6}/).first()).toBeVisible();

  // Klient bez roli admin nie wejdzie do panelu
  await page.getByRole("link", { name: /Sklep/ }).first().click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test.describe("mobile 375 px — brak poziomego scrolla", () => {
  test.use({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });

  test("kluczowe strony mieszczą się w szerokości ekranu", async ({ page }) => {
    const p = await getProduct("KAI-KEX-35");
    const paths = ["/", "/kategoria/klimatyzacja", "/kategoria/klimatyzatory-split?widok=list", `/produkt/${p.slug}`, "/szukaj?q=pompa", "/b2b", "/strona/dostawa-i-platnosc", "/logowanie", "/rejestracja", "/koszyk"];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      expect(scrollWidth, `poziomy scroll na ${path}`).toBeLessThanOrEqual(clientWidth);
    }

    // Checkout z produktem w koszyku
    await page.goto(`/produkt/${p.slug}`);
    // sticky pasek „Do koszyka” na mobile (aria-label zawiera nazwę produktu)
    await page.getByRole("button", { name: `Dodaj do koszyka: ${p.name}` }).click();
    await page.goto("/zamowienie");
    await expect(page.getByRole("heading", { name: "Zamówienie" })).toBeVisible();
    const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(w, "poziomy scroll na /zamowienie").toBeLessThanOrEqual(0);
  });
});
