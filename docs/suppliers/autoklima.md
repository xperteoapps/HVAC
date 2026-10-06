# Hurtownia: Autoklima (`autoklima`)

**Status: brak dostępów — TODO(ustalić).** Adapter `supabase/functions/sync-supplier/adapters/autoklima.ts` rzuca `NotConfiguredError`, dopóki nie są ustawione zmienne `SUPPLIER_AUTOKLIMA_*`; w adminie hurtownia ma status "oczekuje na dane dostępowe" (`suppliers.last_sync_status = 'not_configured'`, `active = false`).

Zgodnie z CLAUDE.md 6.3: najpierw uzupełnić ten plik (format, auth, URL, przykładowy rekord, częstotliwość, stany per magazyn), dopiero potem pisać adapter.

## Dane do uzupełnienia

| pole | wartość |
|---|---|
| Format feedu | TODO(ustalić) — API B2B lub XML |
| Auth | TODO(ustalić) (basic / token / login+hasło / IP whitelist) |
| URL feedu / endpoint | TODO(ustalić) |
| Dokumentacja | TODO(ustalić) |
| Częstotliwość odświeżania cen/stanów po stronie hurtowni | TODO(ustalić) |
| Stany per magazyn (czy feed rozróżnia magazyny) | TODO(ustalić) |
| Limity zapytań / rozmiar feedu | TODO(ustalić) |
| Dropshipping / API zamówień | TODO(ustalić) |
| Cennik partnerski (netto zakupu) w feedzie | TODO(ustalić) |
| Zdjęcia / karty katalogowe w feedzie | TODO(ustalić) |
| Kontakt techniczny | TODO(ustalić) |

## Mapowanie pól

Cel: `SupplierOfferRaw` (`adapters/types.ts`). Kolumna "pole feedu" do uzupełnienia po otrzymaniu dokumentacji.

| pole feedu | pole `SupplierOfferRaw` | typ | uwagi |
|---|---|---|---|
| | `supplierSku` | string | wymagane; klucz upsertu `(supplier_id, supplier_sku)` |
| | `ean` | string? | podstawa auto-mappingu |
| | `name` | string | wymagane |
| | `brand` | string? | brak → wyciągana z nazwy w `normalize.ts` |
| | `categoryPath` | string[]? | ścieżka kategorii hurtowni → `category-map.json` |
| | `purchaseNetCents` | number | cena zakupu netto w groszach (integer) |
| | `stock` | number | `-1` = nieznany; suma magazynów jeśli per magazyn |
| | `leadTimeDays` | number? | czas dostawy przy stanie 0 |
| | `attributes` | Record<string, string \| number>? | parametry techniczne → słownik w `normalize.ts` |
| | `images` | string[]? | URL-e zdjęć |
| | `documents` | {name, url}[]? | karty katalogowe, instrukcje, deklaracje |
| (cały rekord) | `raw` | unknown | zapisywany w `supplier_offers.raw` |

## Przykładowy rekord

```
TODO(ustalić): wklej surowy rekord z feedu (XML / CSV / JSON)
```

## Pytania wysłane do hurtowni

1. Czy udostępniacie feed produktowy dla partnerów (API REST / XML / CSV / FTP)? Dokumentacja?
2. Czy feed zawiera: EAN, SKU, cenę netto zakupu (cennik partnerski), stan magazynowy, czas dostawy, zdjęcia, karty katalogowe, parametry techniczne?
3. Jak często odświeżane są stany i ceny? Limity zapytań?
4. Czy możliwe jest składanie zamówień przez API (dropshipping) czy tylko ręcznie?
5. Dane dostępowe testowe.

Data wysłania: TODO(ustalić). Odpowiedź: TODO(ustalić).

## Zmienne środowiskowe (Supabase → Edge Function secrets)

| zmienna | opis |
|---|---|
| `SUPPLIER_AUTOKLIMA_URL` | URL feedu / endpointu API |
| `SUPPLIER_AUTOKLIMA_LOGIN` | login / identyfikator partnera |
| `SUPPLIER_AUTOKLIMA_PASSWORD` | hasło / token |
| `SUPPLIER_AUTOKLIMA_FORMAT` | `csv` \| `xml` \| `json` — wybór parsera w adapterze |

Po ustawieniu sekretów: w adminie ustawić `suppliers.active = true` i `feed_type` (`api`/`xml`/`csv`/`ftp`), uruchomić "Synchronizuj teraz", sprawdzić `sync_runs.errors`, zmapować resztki w kolejce mapowania. Harmonogram pg_cron: `10 * * * *` (patrz `docs/architecture.md`).

## Znany asortyment (orientacyjnie, CLAUDE.md 6.3)

Klimatyzacja, pompy ciepła, akcesoria montażowe (rury miedziane, wsporniki, pompki skroplin, kable). Kandydat na główne źródło kategorii `akcesoria-montazowe`.

Priorytet hurtowni w `recalc_product` (remis cen): `suppliers.priority = 20` (seed).
