import { describe, expect, it } from "vitest";
import {
  extractBrand, makeSku, mapCategory, normalizeAttributes, normalizeEan, slugify, stripSupplierPrefix, parseCapacityKw,
} from "../supabase/functions/sync-supplier/normalize.ts";
import { parseCsv, parseXmlItems, toCents, parseIntSafe } from "../supabase/functions/sync-supplier/parsers.ts";
import { unitNetAfterDiscount, vatCents, orderTotals, formatPln } from "../supabase/functions/_shared/pricing.ts";
import { computeShippingOptions, type ShippingMethodRow } from "../supabase/functions/_shared/shipping.ts";
import { MOCK_ITEMS } from "../supabase/functions/sync-supplier/adapters/mock-data.ts";

describe("normalize", () => {
  it("maps all mock category paths", () => {
    const paths = new Map<string, string | null>();
    for (const it of MOCK_ITEMS) paths.set(it.category.join(" > "), mapCategory(it.category));
    expect(paths.get("Klimatyzacja > Klimatyzatory ścienne split")).toBe("klimatyzatory-split");
    expect(paths.get("Klimatyzacja > Systemy multi-split")).toBe("multi-split");
    expect(paths.get("Klimatyzacja > Kasetonowe")).toBe("kasetonowe");
    expect(paths.get("Klimatyzacja > Kanałowe")).toBe("kanalowe");
    expect(paths.get("Klimatyzacja > Przenośne")).toBe("przenosne");
    expect(paths.get("Pompy ciepła > Monoblok")).toBe("monoblok");
    expect(paths.get("Pompy ciepła > Split")).toBe("pompy-split");
    expect(paths.get("Pompy ciepła > CWU")).toBe("cwu");
    expect(paths.get("Wentylacja > Rekuperatory")).toBe("rekuperatory");
    expect(paths.get("Wentylacja > Wentylatory")).toBe("wentylatory");
    expect(paths.get("Wentylacja > Kanały")).toBe("kanaly-i-ksztaltki");
    expect(paths.get("Czynniki > Czynniki chłodnicze")).toBe("czynniki-chlodnicze");
    expect(paths.get("Narzędzia > Narzędzia serwisowe")).toBe("narzedzia");
    expect(paths.get("Narzędzia > Manometry")).toBe("manometry-i-pompy-prozniowe");
    expect(paths.get("Akcesoria > Rury miedziane")).toBe("rury-miedziane");
    expect(paths.get("Akcesoria > Wsporniki")).toBe("wsporniki");
    expect(paths.get("Akcesoria > Pompki skroplin")).toBe("pompki-skroplin");
    expect(paths.get("Akcesoria > Kable")).toBe("kable-i-przewody");
    expect(paths.get("Akcesoria > Izolacje")).toBe("izolacje");
    expect(paths.get("Serwis > Filtry")).toBe("filtry");
    expect(paths.get("Serwis > Piloty")).toBe("piloty");
    expect(paths.get("Serwis > Części elektroniczne")).toBe("plytki-i-czujniki");
    for (const [p, v] of paths) expect(v, p).not.toBeNull();
    expect(mapCategory(["Pompy ciepła", "Powietrze-woda", "Split"])).toBe("pompy-split");
    expect(mapCategory(["Klimatyzacja", "Split"])).toBe("klimatyzatory-split");
    expect(mapCategory(["Cośinnego"])).toBeNull();
  });

  it("normalizes attributes with aliases and units", () => {
    const out = normalizeAttributes({
      "moc chłodnicza [kW]": "3,5 kW",
      "Heating capacity": "12000 BTU",
      "Moc chł.": "3500 W",
      "SEER": "6,4",
      "Czynnik": "r-32",
      "Klasa energetyczna": "a++",
      "Zasilanie": "230V",
      "Power supply": "3F",
      "Poziom hałasu": "22 dB(A)",
      "Wi-Fi": "tak",
      "Waga": "45,7 kg",
      "Jakiś Nowy Parametr": "x",
      moc_chlodnicza_kw: 2.6,
      wifi: "nie",
      "spręż_pa": 80,
    });
    expect(out.moc_chlodnicza_kw).toBe(3.5);
    expect(out.moc_grzewcza_kw).toBe(3.52);
    expect(out.seer).toBe(6.4);
    expect(out.czynnik).toBe("R32");
    expect(out.klasa_energetyczna_chlodzenie).toBe("A++");
    expect(out.zasilanie).toBe("1-fazowe");
    expect(out.poziom_halasu_db).toBe(22);
    expect(out.wifi).toBe(true);
    expect(out.weight_kg).toBe(45.7);
    expect(out.jakis_nowy_parametr).toBe("x");
    expect(out["spręż_pa"]).toBe(80);
    expect(parseCapacityKw("3500 W")).toBe(3.5);
    expect(parseCapacityKw(3500)).toBe(3.5);
    expect(normalizeAttributes({ Zasilanie: "400V" }).zasilanie).toBe("3-fazowe");
    expect(normalizeAttributes({ zasilanie: "1-fazowe" }).zasilanie).toBe("1-fazowe");
    expect(normalizeAttributes({ zasilanie: "3-fazowe" }).zasilanie).toBe("3-fazowe");
  });

  it("brands, sku, ean, slug", () => {
    expect(extractBrand("Klimatyzator ścienny KAISAI Eco", "")).toBe("KAISAI");
    expect(extractBrand("Pompa ciepła Mitsubishi Electric Zubadan")).toBe("Mitsubishi Electric");
    expect(extractBrand("Rura miedziana", "Armacell")).toBe("Armacell");
    expect(extractBrand("coś lg", undefined)).toBe("LG");
    expect(extractBrand("Blgx")).toBeNull();
    expect(makeSku("mock", "MOCK-KAI-KEX-26")).toBe("MOCK-KAI-KEX-26");
    expect(makeSku("iglocar", "abc 12/3ą")).toBe("IGLOCAR-ABC-12/3A");
    expect(stripSupplierPrefix("mock", "MOCK-KAI-KEX-26")).toBe("KAI-KEX-26");
    expect(normalizeEan("5900000000015")).toBe("5900000000015");
    expect(normalizeEan("59-0000")).toBeNull();
    expect(normalizeEan("")).toBeNull();
    expect(slugify("Klimatyzator ścienny KAISAI Eco KEX 2.6 kW")).toBe("klimatyzator-scienny-kaisai-eco-kex-2-6-kw");
  });
});

describe("parsers", () => {
  it("csv with quotes", () => {
    const rows = parseCsv('sku;name;price\r\nA1;"Rura ""x""; 15 m";1 234,56\nA2;B;12.5\n');
    expect(rows).toEqual([
      { sku: "A1", name: 'Rura "x"; 15 m', price: "1 234,56" },
      { sku: "A2", name: "B", price: "12.5" },
    ]);
  });
  it("xml items", () => {
    const rows = parseXmlItems(
      `<root><product id="1"><sku>A1</sku><name><![CDATA[Rura & 1/4"]]></name><price>12,5</price><img/></product><product><sku>A2</sku><name>B &amp; C</name></product></root>`,
      "product",
    );
    expect(rows[0]).toEqual({ sku: "A1", name: 'Rura & 1/4"', price: "12,5", img: "" });
    expect(rows[1]).toEqual({ sku: "A2", name: "B & C" });
  });
  it("toCents / parseIntSafe", () => {
    expect(toCents("1 234,56")).toBe(123456);
    expect(toCents("1234.56")).toBe(123456);
    expect(toCents("1,234.56")).toBe(123456);
    expect(toCents("1.234,56 zł")).toBe(123456);
    expect(toCents(12.5)).toBe(1250);
    expect(toCents("abc")).toBeNull();
    expect(parseIntSafe("7 szt.")).toBe(7);
    expect(parseIntSafe("")).toBeNull();
  });
});

describe("pricing + shipping", () => {
  it("discount, vat, totals", () => {
    expect(unitNetAfterDiscount(100000, 5)).toBe(95000);
    expect(vatCents(95000, 23)).toBe(21850);
    const t = orderTotals([{ qty: 2, unit_net_cents: 95000, vat_rate: 23 }], 1990);
    expect(t.subtotal_net_cents).toBe(190000);
    expect(t.vat_cents).toBe(43700 + 458);
    expect(t.total_gross_cents).toBe(190000 + 1990 + 43700 + 458);
    expect(formatPln(123456)).toBe("1 234,56 zł");
  });
  const methods: ShippingMethodRow[] = [
    { code: "courier_dpd", name: "DPD", carrier: "DPD", description: null, price_net_cents: 1990, free_from_cents: 150000, free_from_cents_b2b: 200000, max_weight_kg: "30.000", pallet: false, pickup: false, active: true, position: 10 },
    { code: "courier_inpost", name: "InPost", carrier: "InPost", description: null, price_net_cents: 1690, free_from_cents: 150000, free_from_cents_b2b: 200000, max_weight_kg: 25, pallet: false, pickup: false, active: true, position: 20 },
    { code: "pallet", name: "Paleta", carrier: "Raben", description: null, price_net_cents: 19900, free_from_cents: null, free_from_cents_b2b: 500000, max_weight_kg: null, pallet: true, pickup: false, active: true, position: 30 },
    { code: "pickup", name: "Odbiór", carrier: null, description: null, price_net_cents: 0, free_from_cents: null, free_from_cents_b2b: null, max_weight_kg: null, pallet: false, pickup: true, active: true, position: 50 },
    { code: "off", name: "Off", carrier: null, description: null, price_net_cents: 0, free_from_cents: null, free_from_cents_b2b: null, max_weight_kg: null, pallet: false, pickup: true, active: false, position: 1 },
  ];
  it("courier for light parcel, free above threshold (B2C gross)", () => {
    const r = computeShippingOptions({ items: [{ weight_kg: 10, pallet_required: false, qty: 2, line_net_cents: 130000, line_gross_cents: 159900 }], methods, priceMode: "gross" });
    expect(r.needsPallet).toBe(false);
    expect(r.totalWeightKg).toBe(20);
    expect(r.options.map((o) => o.code)).toEqual(["courier_dpd", "courier_inpost", "pickup"]);
    expect(r.options[0].price_net_cents).toBe(0);
    expect(r.options[0].free).toBe(true);
  });
  it("inpost excluded above 25kg; pallet when >30kg or pallet_required; B2B net threshold", () => {
    const r = computeShippingOptions({ items: [{ weight_kg: 14, pallet_required: false, qty: 2, line_net_cents: 10000, line_gross_cents: 12300 }], methods, priceMode: "gross" });
    expect(r.options.map((o) => o.code)).toEqual(["courier_dpd", "pickup"]);
    expect(r.options[0].price_gross_cents).toBe(2448);
    const p = computeShippingOptions({ items: [{ weight_kg: 1, pallet_required: true, qty: 1, line_net_cents: 600000, line_gross_cents: 738000 }], methods, priceMode: "net" });
    expect(p.needsPallet).toBe(true);
    expect(p.options.map((o) => o.code)).toEqual(["pallet", "pickup"]);
    expect(p.options[0].price_net_cents).toBe(0);
    const q = computeShippingOptions({ items: [{ weight_kg: 31, pallet_required: false, qty: 1, line_net_cents: 1000, line_gross_cents: 1230 }], methods, priceMode: "net" });
    expect(q.options.map((o) => o.code)).toEqual(["pallet", "pickup"]);
    expect(q.options[0].price_net_cents).toBe(19900);
  });
});
