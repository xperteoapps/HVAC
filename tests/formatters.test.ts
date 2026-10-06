import { describe, expect, it } from "vitest";
import { formatAttributeValue, formatPrice, plural, formatNip } from "@/lib/formatters";
import { isValidNip, postalCodeSchema } from "@/lib/validators";
import { parseFilters } from "@/components/catalog/filters";

describe("formatters", () => {
  it("formatuje PLN z groszy", () => {
    expect(formatPrice(123456).replace(/\s/g, " ")).toMatch(/^1 ?234,56 zł$/);
    expect(formatPrice(12345678).replace(/\s/g, " ")).toBe("123 456,78 zł");
    expect(formatPrice(null)).toBe("—");
  });
  it("liczba mnoga", () => {
    expect(plural(1, "produkt", "produkty", "produktów")).toBe("1 produkt");
    expect(plural(3, "produkt", "produkty", "produktów")).toBe("3 produkty");
    expect(plural(12, "produkt", "produkty", "produktów")).toBe("12 produktów");
    expect(plural(22, "produkt", "produkty", "produktów")).toBe("22 produkty");
  });
  it("atrybuty", () => {
    expect(formatAttributeValue(true)).toBe("tak");
    expect(formatAttributeValue(3.5, "kW")).toBe("3,5 kW");
    expect(formatAttributeValue("R32")).toBe("R32");
  });
  it("NIP", () => {
    expect(isValidNip("5260250995")).toBe(true);
    expect(isValidNip("1234567890")).toBe(false);
    expect(formatNip("5260250995")).toBe("526-025-09-95");
    expect(postalCodeSchema.safeParse("00-001").success).toBe(true);
    expect(postalCodeSchema.safeParse("00001").success).toBe(false);
  });
});

describe("filters URL state", () => {
  it("parsuje parametry listingu", () => {
    const params = new URLSearchParams("marka=kaisai,gree&czynnik=R32&moc_chlodnicza_kw=3.5-5&cena=1000-&dostepnosc=in_stock&sort=price_asc&strona=2&widok=list&wifi=1");
    const s = parseFilters(params, new Set(["moc_chlodnicza_kw"]));
    expect(s.brands).toEqual(["kaisai", "gree"]);
    expect(s.attrValues).toEqual({ czynnik: ["R32"] });
    expect(s.attrRanges).toEqual({ moc_chlodnicza_kw: [3.5, 5] });
    expect(s.priceMin).toBe(100000);
    expect(s.priceMax).toBeNull();
    expect(s.availability).toBe("in_stock");
    expect(s.sort).toBe("price_asc");
    expect(s.page).toBe(2);
    expect(s.view).toBe("list");
    expect(s.wifi).toBe(true);
  });
});
