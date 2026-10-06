# Płatności online — imoje (ING)

Decyzja klienta (ADR-014): bramka płatności online = **imoje** (ING Bank Śląski): BLIK, karty, szybkie przelewy (pbl), Apple Pay / Google Pay, raty i odroczenia wg konfiguracji w panelu imoje. Przelew tradycyjny (`manual`) i płatność odroczona B2B pozostają bez zmian.

## Jak to działa

1. **Checkout** — klient wybiera „Płatność online — BLIK, karta, szybki przelew” (opcja widoczna tylko, gdy `calc-shipping` zwróci `payment_providers` zawierające `imoje`, czyli gdy sekrety są ustawione).
2. **`create-order`** tworzy zamówienie (`status=awaiting_payment`, `payment_status=pending`, `payment_provider=imoje`), a następnie woła imoje REST API `POST {api}/merchant/{merchantId}/payment` (link płatności) i zwraca `payment.redirectUrl`. Front przekierowuje na tę stronę. Jeśli API imoje nie odpowie, zamówienie **zostaje** z `payment_provider=manual`, klient dostaje dane do przelewu oraz `payment.warning`; link można wygenerować później.
3. **`payment-webhook`** odbiera notyfikację imoje (POST JSON, nagłówek `X-Imoje-Signature: merchantid=…;serviceid=…;signature=…;alg=sha256`), weryfikuje `signature == hash(alg, rawBody + serviceKey)`, zgodność `merchantId`/`serviceId`, kwotę (`transaction.amount` = `orders.total_gross_cents`) i walutę `PLN`, a następnie:

   | `transaction.type` | `transaction.status` | skutek |
   |---|---|---|
   | sale | `settled` | `payment_status=paid`, `status=paid` (gdy było `new`/`awaiting_payment`), `payment_ref=transaction.id` |
   | sale | `rejected`, `cancelled`, `error` | `payment_status=failed` (status zamówienia bez zmian — klient może zapłacić ponownie) |
   | sale | `new`, `authorized`, `pending`, `submitted_for_settlement` | bez zmian (log w `order_events`) |
   | refund | `settled` / `refund` | `payment_status=refunded`, `status=refunded` |

   Każda notyfikacja trafia do `order_events` (`type=payment_notification`). Odpowiedź: `200 {"status":"ok"}`. Przy złym podpisie: `401` (imoje ponowi).
4. **`create-payment`** — ponowny link dla nieopłaconego zamówienia („Zapłać online” w koncie klienta i na stronie potwierdzenia po nieudanej płatności). Autoryzacja: właściciel (JWT) / admin, albo gość przez `order_number + email`.
5. **Powrót z bramki**: `successReturnUrl` → `/zamowienie/potwierdzenie/<numer>?platnosc=ok`, `failureReturnUrl` → `?platnosc=blad`, `returnUrl` → `?platnosc=powrot`. Strona potwierdzenia pokazuje odpowiedni komunikat; stan faktyczny zawsze z notyfikacji.

## Konfiguracja

### Sekrety Edge Functions (Supabase → Edge Functions → Secrets)

| Sekret | Opis |
|---|---|
| `IMOJE_MERCHANT_ID` | ID klienta (panel imoje → Sklepy → Dane do integracji) |
| `IMOJE_SERVICE_ID` | ID sklepu |
| `IMOJE_SERVICE_KEY` | Klucz sklepu (do podpisu notyfikacji) |
| `IMOJE_API_KEY` | Token autoryzacyjny API (Bearer) |
| `IMOJE_ENV` | `sandbox` (domyślnie) lub `production` |
| `IMOJE_API_URL` | opcjonalnie — nadpisanie bazy API, np. `https://api.pay.ing.pl/v1` po migracji domen ING |
| `IMOJE_NOTIFICATION_URL` | opcjonalnie — adres notyfikacji wysyłany do imoje (domyślnie `${SUPABASE_URL}/functions/v1/payment-webhook`) |
| `PAYMENT_PROVIDERS` | lista włączonych dostawców, np. `manual,imoje` (domyślnie `manual`) |
| `SHOP_URL` | publiczny adres sklepu (adresy powrotu) |

Bazowe adresy API: produkcja `https://api.imoje.pl/v1`, sandbox `https://sandbox.api.imoje.pl/v1` (`_shared/payments/imoje-core.ts`).

### Panel imoje

1. Sklepy → wybrany sklep → **Adres notyfikacji**: `https://<ref>.supabase.co/functions/v1/payment-webhook` (funkcja i tak wysyła `notificationUrl` w żądaniu).
2. Włącz metody płatności (BLIK, karty, pbl, Apple/Google Pay) wg umowy.
3. Sandbox: dane testowe z panelu sandbox; kart testowych i BLIK użyj wg dokumentacji imoje.

### Test lokalny webhooka

```bash
BODY='{"transaction":{"id":"t1","type":"sale","status":"settled","serviceId":"<SERVICE_ID>","amount":384621,"currency":"PLN","orderId":"<orders.id>"}}'
SIG=$(printf '%s%s' "$BODY" "<SERVICE_KEY>" | sha256sum | cut -d' ' -f1)
curl -s -X POST "$SUPABASE_URL/functions/v1/payment-webhook" \
  -H "Content-Type: application/json" \
  -H "X-Imoje-Signature: merchantid=<MERCHANT_ID>;serviceid=<SERVICE_ID>;signature=$SIG;alg=sha256" \
  -d "$BODY"
```

Oczekiwane: `{"status":"ok"}` i zamówienie w statusie `paid`.

## Pliki

- `supabase/functions/_shared/payments/imoje-core.ts` — czysta logika (podpisy, walidacja notyfikacji, mapowanie statusów, payload) — testy w `tests/imoje.test.ts`.
- `supabase/functions/_shared/payments/imoje.ts` — provider: konfiguracja z env, wywołanie API, lista dostawców.
- `supabase/functions/payment-webhook/index.ts`, `supabase/functions/create-payment/index.ts`, zmiany w `create-order` i `calc-shipping`.
- Front: `src/lib/payments/imoje.ts`, `src/lib/payments/pay-online.ts`, `PaymentSelector`, `Checkout`, `OrderConfirm`, `account/Orders`.

## Nie zrobione / do ustalenia

- Zwroty z panelu admina (API `POST …/transaction/{id}/refund`) — faza późniejsza; dziś zwrot wykonuje się w panelu imoje, a notyfikacja `refund` aktualizuje zamówienie.
- Widget kartowy / płatność w sklepie bez przekierowania — nie w MVP.
- Dokumentacja bump.sh/imoje była niedostępna z tego środowiska; integrację oparto na oficjalnych modułach imoje (WooCommerce, laravel-imoje). Po otrzymaniu dostępów do sandboxa zweryfikować pierwszą transakcję end-to-end.
