// Adapter hurtowni KAISAI (code: 'kaisai').
// STATUS: brak dostępów — rzuca NotConfiguredError dopóki nie ustawisz SUPPLIER_KAISAI_URL
// (lub feed_config.url w tabeli suppliers). Platforma partnerska / XML producenta (klimatyzatory, pompy ciepła, rekuperacja KAISAI).
//
// Mapa pól poniżej to PLACEHOLDER — TODO(ustalić): uzupełnić po otrzymaniu dokumentacji feedu
// i wpisaniu przykładowego rekordu do docs/suppliers/kaisai.md.

import { createFeedAdapter, type FeedFieldMap } from "./feed-adapter.ts";

const FIELD_MAP: FeedFieldMap = {
  supplierSku: "sku", // TODO(ustalić): nazwa pola z indeksem hurtowni
  ean: "ean", // TODO(ustalić)
  name: "name", // TODO(ustalić)
  brand: "brand", // TODO(ustalić)
  category: "category", // TODO(ustalić): ścieżka "A > B" albo lista pól poziomów
  purchaseNet: "price_net", // TODO(ustalić): cena zakupu netto (cennik partnerski)
  stock: "stock", // TODO(ustalić): stan łączny czy per magazyn?
  leadTimeDays: "lead_time_days", // TODO(ustalić)
  images: "images", // TODO(ustalić): lista URL rozdzielona przecinkiem
  attributes: {
    // pole w feedzie → etykieta (normalize.ts mapuje etykiety na nasze klucze)
    cooling_capacity: "Moc chłodnicza [kW]",
    heating_capacity: "Moc grzewcza [kW]",
    energy_class: "Klasa energetyczna",
    refrigerant: "Czynnik",
    power_supply: "Zasilanie",
    noise_level: "Poziom hałasu",
    weight: "Waga",
  },
  documents: {
    datasheet_url: "Karta katalogowa", // TODO(ustalić)
    manual_url: "Instrukcja", // TODO(ustalić)
  },
};

export const kaisaiAdapter = createFeedAdapter({
  code: "kaisai",
  supplierName: "KAISAI",
  fieldMap: FIELD_MAP,
  xmlItemTag: "product", // TODO(ustalić): nazwa elementu rekordu w XML
  csvDelimiter: ";",
});
