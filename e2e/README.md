# Testy e2e (Playwright) na pełnym lokalnym Supabase

Scenariusze (CLAUDE.md, Faza 2 pkt 15 + DoD):

| Plik | Test |
|---|---|
| `shop.spec.ts` | gość: katalog → koszyk → checkout (przelew) → potwierdzenie |
| `shop.spec.ts` | gość: płatność online imoje → bramka → podpisana notyfikacja → zamówienie opłacone |
| `shop.spec.ts` | B2B: ceny netto z rabatem grupy, zamówienie z płatnością odroczoną 14 dni |
| `shop.spec.ts` | sync hurtowni mock przelicza cenę widoczną w sklepie |
| `shop.spec.ts` | wyszukiwarka (podpowiedzi + wyniki), filtr marki w URL |
| `admin-mobile.spec.ts` | panel admina: dashboard, „Synchronizuj teraz”, lista zamówień |
| `admin-mobile.spec.ts` | mobile 375 px: brak poziomego scrolla na kluczowych stronach i w checkout |

## Uruchomienie

```bash
# 1. Lokalny Supabase (Docker). W środowiskach bez dostępu do public.ecr.aws:
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start -x studio,imgproxy,vector,logflare,realtime,supavisor,storage-api

# 2. Sekrety funkcji do testów: supabase/functions/.env.local (nie commitować), np.:
#    SHOP_URL=http://localhost:8080
#    PAYMENT_PROVIDERS=manual,imoje
#    IMOJE_ENV=sandbox  IMOJE_MERCHANT_ID=testmerchant  IMOJE_SERVICE_ID=11111111-2222-3333-4444-555555555555
#    IMOJE_SERVICE_KEY=lokalny-klucz-testowy  IMOJE_API_KEY=lokalny-token  IMOJE_API_URL=http://imoje-mock:8090/v1
#    oraz atrapa API imoje: docker run -d --name imoje-mock --network supabase_network_hvac -v "$PWD/scripts/imoje-mock:/app:ro" python:3.12-alpine python /app/server.py
#    Za proxy TLS (sesje w chmurze) odtwórz Edge Runtime z zaufanym CA i sekretami z .env.local:
scripts/edge-runtime-with-ca.sh

# 3. Front wskazujący na lokalny Supabase: .env.local
#    VITE_SUPABASE_URL=http://127.0.0.1:54321
#    VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY z `npx supabase status`>

# 4. Testy (Playwright sam uruchamia `npm run dev` na 127.0.0.1:8080)
npm run test:e2e
```

Atrapa imoje (minimalny serwer zwracający `{ payment: { id, url } }` dla `POST /v1/merchant/{id}/payment` z tokenem `Bearer lokalny-token`) — uruchomiona jako kontener `imoje-mock` w sieci `supabase_network_hvac`. Bramka w przeglądarce jest przechwytywana przez `page.route`, a notyfikację wysyła test z poprawnym podpisem `sha256(rawBody + serviceKey)`.

Testy tworzą własnych użytkowników (unikalne e-maile) i nie wymagają czyszczenia bazy; pełny reset: `npx supabase db reset`.
