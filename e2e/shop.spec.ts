import { test, expect } from "@playwright/test";
import {
  api,
  createUser,
  customerGroupId,
  fillCheckout,
  getOrder,
  getProduct,
  login,
  plnText,
  prepareContext,
  runSync,
  sendImojeNotification,
  squash,
  uniqueEmail,
  updateProfile,
} from "./helpers";

test.beforeEach(async ({ context }) => {
  await prepareContext(context);
});

test("gość: katalog → koszyk → checkout (przelew) → potwierdzenie", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sprzęt HVAC");

  // Kategoria z mega menu/kafla → listing z filtrami
  await page.getByRole("link", { name: /Akcesoria montażowe/ }).first().click();
  await expect(page).toHaveURL(/\/kategoria\/akcesoria-montazowe/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akcesoria montażowe");
  await expect(page.getByText(/\d+ produkt/).first()).toBeVisible();

  // Karta produktu
  await page.getByRole("link", { name: "Pompka skroplin Aspen Mini Lime" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pompka skroplin Aspen Mini Lime");
  await expect(page.getByRole("tab", { name: "Specyfikacja" })).toBeVisible();
  await page.getByRole("button", { name: "Dodaj do koszyka", exact: true }).click();

  // Drawer koszyka → kasa
  await expect(page.getByRole("dialog").getByText("Pompka skroplin Aspen Mini Lime")).toBeVisible();
  await page.getByRole("link", { name: "Do kasy" }).click();
  await expect(page).toHaveURL(/\/zamowienie$/);

  // Lekka paczka → kurier dostępny
  await expect(page.getByText("Kurier DPD", { exact: true })).toBeVisible();
  await expect(page.getByText("Dostawa paletowa", { exact: true })).toHaveCount(0);

  const email = uniqueEmail("gosc");
  await fillCheckout(page, { email, name: "Anna Gościnna" });
  await page.getByText("Przelew tradycyjny / proforma", { exact: true }).click();
  await page.getByRole("button", { name: "Zamawiam i płacę" }).click();

  await expect(page.getByRole("heading", { name: "Dziękujemy za zamówienie!" })).toBeVisible();
  const number = (await page.locator("strong").filter({ hasText: /^ZAM\/\d{4}\/\d{6}$/ }).first().textContent())!.trim();
  await expect(page.getByText("Dane do przelewu")).toBeVisible();

  const order = await getOrder(number);
  expect(order.email).toBe(email);
  expect(order.status).toBe("awaiting_payment");
  expect(order.payment_provider).toBe("manual");
  expect(order.shipping_method).toBe("courier_dpd");

  // Koszyk wyczyszczony
  await page.goto("/koszyk");
  await expect(page.getByText("Twój koszyk jest pusty")).toBeVisible();
});

test("gość: płatność online imoje → bramka → notyfikacja → opłacone", async ({ page }) => {
  // Bramka imoje (sandbox) — w testach przechwytujemy przekierowanie
  await page.route(/^https:\/\/sandbox\.paywall\.imoje\.pl\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Bramka imoje (test)</h1>" }),
  );
  const p = await getProduct("FIL-KAI-KEX");
  await page.goto(`/produkt/${p.slug}`);
  await page.getByRole("button", { name: "Dodaj do koszyka", exact: true }).click();
  await page.goto("/zamowienie");

  const email = uniqueEmail("imoje");
  await fillCheckout(page, { email, name: "Piotr Płacący" });
  await expect(page.getByText("Płatność online — BLIK, karta, szybki przelew")).toBeVisible();
  await page.getByText("Płatność online — BLIK, karta, szybki przelew", { exact: true }).click();
  await page.getByRole("button", { name: "Zamawiam i przechodzę do płatności" }).click();

  await expect(page).toHaveURL(/sandbox\.paywall\.imoje\.pl/);
  await expect(page.getByRole("heading", { name: "Bramka imoje (test)" })).toBeVisible();

  // Zamówienie utworzone przed przekierowaniem (provider imoje, oczekuje na płatność)
  const rows = await api<Array<{ id: string; number: string; total_gross_cents: number; payment_provider: string; payment_status: string }>>(
    `/rest/v1/orders?email=eq.${encodeURIComponent(email)}&select=id,number,total_gross_cents,payment_provider,payment_status`,
  );
  expect(rows).toHaveLength(1);
  const order = rows[0];
  expect(order.payment_provider).toBe("imoje");
  expect(order.payment_status).toBe("pending");

  const res = await sendImojeNotification({ id: `tx-${Date.now()}`, status: "settled", amount: order.total_gross_cents, orderId: order.id, paymentMethod: "blik" });
  expect(res.status).toBe(200);

  // Powrót z bramki na successReturnUrl (ta sama karta → sessionStorage z potwierdzeniem)
  await page.goBack();
  await page.goto(`/zamowienie/potwierdzenie/${encodeURIComponent(order.number)}?platnosc=ok`);
  await expect(page.getByText("Płatność została przyjęta")).toBeVisible();
  const db = await getOrder(order.number);
  expect(db.payment_status).toBe("paid");
  expect(db.status).toBe("paid");
});

test("B2B: ceny netto z rabatem i zamówienie z płatnością odroczoną", async ({ page }) => {
  const email = uniqueEmail("b2b");
  const password = "Haslo-Testowe-123";
  const userId = await createUser(email, password, "Instalator Testowy");
  await updateProfile(userId, {
    company_name: "Klimat-Serwis Sp. z o.o.",
    nip: "5260250995",
    b2b_requested: true,
    b2b_approved: true,
    deferred_payment_allowed: true,
    customer_group_id: await customerGroupId("b2b_vip"),
  });

  await login(page, email, password);
  await expect(page.getByText("B2B · Instalator B2B VIP")).toBeVisible();

  const p = await getProduct("KAI-KEX-26");
  await page.goto(`/produkt/${p.slug}`);
  const expectedNet = Math.round(p.price_net_cents * 0.9); // rabat grupy VIP 10%
  const priceBox = page.locator("div.rounded-lg.border.bg-card.p-4").filter({ hasText: "Dodaj do koszyka" });
  await expect(priceBox).toContainText("netto");
  expect(squash(await priceBox.textContent())).toContain(squash(plnText(expectedNet)));
  await expect(priceBox).toContainText("rabat 10%");

  await page.getByRole("button", { name: "Dodaj do koszyka", exact: true }).click();
  await page.goto("/zamowienie");
  await expect(page.locator("#email")).toHaveValue(email);
  await fillCheckout(page, { name: "Instalator Testowy" });
  await page.getByText("Płatność odroczona 14 dni", { exact: true }).click();
  await page.getByRole("button", { name: "Zamawiam i płacę" }).click();

  await expect(page.getByRole("heading", { name: "Dziękujemy za zamówienie!" })).toBeVisible();
  await expect(page.getByText("Termin płatności", { exact: true })).toBeVisible();
  const number = (await page.locator("strong").filter({ hasText: /^ZAM\// }).first().textContent())!.trim();
  const order = await getOrder(number);
  expect(order.status).toBe("processing");
  expect(order.payment_status).toBe("deferred");
  expect(order.customer_group_code).toBe("b2b_vip");
  expect(order.price_mode).toBe("net");
  expect(order.payment_due_date).toBeTruthy();

  // Historia w koncie klienta
  await page.goto("/konto/zamowienia");
  await expect(page.getByRole("link", { name: number })).toBeVisible();
});

test("sync hurtowni mock przelicza cenę widoczną w sklepie", async ({ page }) => {
  const p = await getProduct("KAI-KEX-53");
  const offers = await api<Array<{ id: string; purchase_net_cents: number }>>(
    `/rest/v1/supplier_offers?product_id=eq.${p.id}&supplier_id=eq.${p.best_supplier_id}&select=id,purchase_net_cents`,
  );
  const offer = offers[0];

  // Symulacja starego cennika hurtowni (+500 zł) → trigger przelicza produkt
  await api(`/rest/v1/supplier_offers?id=eq.${offer.id}`, { method: "PATCH", json: { purchase_net_cents: offer.purchase_net_cents + 50_000 } });
  const raised = await getProduct("KAI-KEX-53");
  expect(raised.price_gross_cents).toBeGreaterThan(p.price_gross_cents);
  await page.goto(`/produkt/${p.slug}`);
  expect(squash(await page.locator("main").textContent())).toContain(squash(plnText(raised.price_gross_cents)));

  // Sync z feedu przywraca aktualny cennik → cena w sklepie wraca
  const sync = await runSync("mock");
  expect(sync.status).toBe("ok");
  const after = await getProduct("KAI-KEX-53");
  expect(after.price_gross_cents).toBe(p.price_gross_cents);
  await page.reload();
  expect(squash(await page.locator("main").textContent())).toContain(squash(plnText(after.price_gross_cents)));
});

test("wyszukiwarka: podpowiedzi i wyniki", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Szukaj produktów" }).first();
  await search.fill("kaisai 3.5");
  await expect(page.getByRole("button", { name: /KAISAI Eco KEX 3\.5 kW/ }).first()).toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/szukaj\?q=kaisai/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wyniki dla");
  await expect(page.getByRole("link", { name: "Klimatyzator ścienny KAISAI Eco KEX 3.5 kW" }).first()).toBeVisible();
});

test("listing: filtr marki zapisuje się w URL", async ({ page }) => {
  await page.goto("/kategoria/klimatyzatory-split");
  await page.getByText(/^Sinclair \(\d+\)$/).click();
  await expect(page).toHaveURL(/marka=sinclair/);
  await expect(page.getByRole("button", { name: /^Sinclair$/ })).toBeVisible(); // chip aktywnego filtra
  const names = await page.locator("article a.line-clamp-2").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n).toContain("Sinclair");
});
