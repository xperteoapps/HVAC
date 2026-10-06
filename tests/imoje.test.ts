import { describe, expect, it } from "vitest";
import {
  buildImojePaymentLinkPayload,
  extractImojeRedirectUrl,
  imojeApiUrl,
  imojeHash,
  imojePaywallSignature,
  mapImojeOutcome,
  parseImojeNotification,
  parseImojeSignatureHeader,
  splitFullName,
  verifyImojeNotification,
} from "../supabase/functions/_shared/payments/imoje-core.ts";

const cfg = { merchantId: "6yt3gjtm9p7b8h9xsdqz", serviceId: "63f574ed-d4ad-407e-9981-39ed7584a7b7", serviceKey: "tajny-klucz" };

describe("imoje — podpis notyfikacji", () => {
  it("parsuje nagłówek X-Imoje-Signature", () => {
    const h = parseImojeSignatureHeader(`merchantid=${cfg.merchantId};serviceid=${cfg.serviceId};signature=ABC;alg=SHA256`);
    expect(h).toEqual({ merchantid: cfg.merchantId, serviceid: cfg.serviceId, signature: "abc", alg: "sha256" });
    expect(parseImojeSignatureHeader("foo=bar")).toBeNull();
    expect(parseImojeSignatureHeader(null)).toBeNull();
  });

  it("weryfikuje hash(rawBody + serviceKey)", async () => {
    const rawBody = JSON.stringify({ transaction: { id: "t1" } });
    const sig = await imojeHash("sha256", rawBody, cfg.serviceKey);
    const header = parseImojeSignatureHeader(`merchantid=${cfg.merchantId};serviceid=${cfg.serviceId};signature=${sig};alg=sha256`);
    expect((await verifyImojeNotification(rawBody, header, cfg)).ok).toBe(true);
    expect((await verifyImojeNotification(rawBody + " ", header, cfg)).ok).toBe(false);
    expect((await verifyImojeNotification(rawBody, header, { ...cfg, serviceId: "inny" })).ok).toBe(false);
    const sha224 = parseImojeSignatureHeader(`merchantid=${cfg.merchantId};serviceid=${cfg.serviceId};signature=${sig};alg=sha224`);
    expect((await verifyImojeNotification(rawBody, sha224, cfg)).ok).toBe(false);
  });

  it("podpis paywall: sortowane k=v & + serviceKey + ';sha256'", async () => {
    const sig = await imojePaywallSignature({ serviceId: "s", amount: 100, currency: "PLN", orderId: "o1" }, cfg.serviceKey);
    const expected = await imojeHash("sha256", "amount=100&currency=PLN&orderId=o1&serviceId=s", cfg.serviceKey);
    expect(sig).toBe(`${expected};sha256`);
  });
});

describe("imoje — notyfikacja i statusy", () => {
  it("waliduje body notyfikacji", () => {
    const ok = parseImojeNotification({ transaction: { id: "t", type: "sale", status: "settled", serviceId: "s", amount: 1000, currency: "PLN", orderId: "o" } });
    expect(ok.ok).toBe(true);
    expect(parseImojeNotification({ transaction: { id: "t", type: "sale", status: "weird", serviceId: "s", amount: 1, currency: "PLN", orderId: "o" } }).ok).toBe(false);
    expect(parseImojeNotification({}).ok).toBe(false);
  });

  it("mapuje statusy na skutek dla zamówienia", () => {
    expect(mapImojeOutcome("sale", "settled")).toEqual({ kind: "paid" });
    expect(mapImojeOutcome("sale", "rejected")).toEqual({ kind: "failed" });
    expect(mapImojeOutcome("sale", "cancelled")).toEqual({ kind: "failed" });
    expect(mapImojeOutcome("sale", "pending")).toEqual({ kind: "pending" });
    expect(mapImojeOutcome("sale", "authorized")).toEqual({ kind: "pending" });
    expect(mapImojeOutcome("refund", "settled")).toEqual({ kind: "refunded" });
    expect(mapImojeOutcome("refund", "pending").kind).toBe("ignore");
  });
});

describe("imoje — link płatności", () => {
  it("buduje payload w groszach z adresami powrotu i validTo", () => {
    const p = buildImojePaymentLinkPayload({
      serviceId: "s",
      amountCents: 384621,
      orderId: "uuid",
      title: "Zamówienie ZAM/2026/000001",
      customer: { firstName: "Jan", lastName: "Kowalski", email: "jan@test.pl" },
      successReturnUrl: "https://shop/ok",
      failureReturnUrl: "https://shop/fail",
      returnUrl: "https://shop/back",
      notificationUrl: "https://x/functions/v1/payment-webhook",
      nowMs: 1_000_000,
      validForSeconds: 60,
    });
    expect(p.amount).toBe(384621);
    expect(p.currency).toBe("PLN");
    expect(p.validTo).toBe(1060);
    expect(p.notificationUrl).toContain("payment-webhook");
    expect(() => buildImojePaymentLinkPayload({ ...p, amountCents: 0, orderId: "x", customer: p.customer, nowMs: 0 } as never)).toThrow();
  });

  it("wyciąga URL z odpowiedzi i dzieli imię/nazwisko", () => {
    expect(extractImojeRedirectUrl({ payment: { id: "p1", url: "https://pay/1" } })).toEqual({ url: "https://pay/1", id: "p1" });
    expect(extractImojeRedirectUrl({ action: { url: "https://pay/2" }, transaction: { id: "t2" } })).toEqual({ url: "https://pay/2", id: "t2" });
    expect(extractImojeRedirectUrl({})).toBeNull();
    expect(splitFullName("Jan Maria Kowalski")).toEqual({ firstName: "Jan", lastName: "Maria Kowalski" });
    expect(splitFullName("")).toEqual({ firstName: "Klient", lastName: "-" });
    expect(imojeApiUrl({ env: "sandbox" })).toBe("https://sandbox.api.imoje.pl/v1");
    expect(imojeApiUrl({ env: "production", apiUrl: "https://api.pay.ing.pl/v1/" })).toBe("https://api.pay.ing.pl/v1");
  });
});
