import { expect, it } from "vitest";
import { mapMockItem } from "../supabase/functions/sync-supplier/adapters/mock.ts";
import { supplierOfferRawSchema } from "../supabase/functions/sync-supplier/adapters/types.ts";
import { MOCK_ITEMS } from "../supabase/functions/sync-supplier/adapters/mock-data.ts";

it("every mock item validates through supplierOfferRawSchema", () => {
  const failures: string[] = [];
  for (const item of MOCK_ITEMS) {
    const raw = mapMockItem(item, 5);
    const r = supplierOfferRawSchema.safeParse(raw);
    if (!r.success) failures.push(`${item.sku}: ${r.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`);
  }
  expect(failures).toEqual([]);
  const first = mapMockItem(MOCK_ITEMS[0], 5);
  expect(first.images?.[0]).toBe("https://placehold.co/800x800/F8FAFC/0F172A?text=KAI-KEX-26");
  expect(first.documents?.[0].url).toBe("https://example.com/docs/KAI-KEX-26.pdf");
  expect(first.attributes?.wifi).toBe("tak");
  expect(first.attributes?.weight_kg).toBe(43.72);
  expect(mapMockItem(MOCK_ITEMS[1], 0).stock).toBe(18); // 19 + (0%3 - 1)
  expect(mapMockItem(MOCK_ITEMS[2], 0).stock).toBe(3);  // stock <= 3 untouched
});
