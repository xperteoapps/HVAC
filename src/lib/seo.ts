export const SITE_NAME = "Sklep HVAC";
export const SITE_TAGLINE = "klimatyzacja, pompy ciepła, wentylacja";

export function pageTitle(title?: string | null): string {
  return title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
}

export function siteUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function canonical(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonical(item.path),
    })),
  };
}

export interface ProductJsonLdInput {
  name: string;
  sku: string;
  ean?: string | null;
  description?: string | null;
  images: string[];
  brand?: string | null;
  priceGrossCents: number | null;
  stockStatus: string;
  path: string;
}

export function productJsonLd(p: ProductJsonLdInput) {
  const availability =
    p.stockStatus === "unavailable"
      ? "https://schema.org/OutOfStock"
      : p.stockStatus === "on_order"
        ? "https://schema.org/PreOrder"
        : "https://schema.org/InStock";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    ...(p.ean ? { gtin13: p.ean } : {}),
    description: p.description?.replace(/<[^>]+>/g, " ").trim().slice(0, 500),
    image: p.images,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.priceGrossCents !== null
      ? {
          offers: {
            "@type": "Offer",
            url: canonical(p.path),
            priceCurrency: "PLN",
            price: (p.priceGrossCents / 100).toFixed(2),
            availability,
          },
        }
      : {}),
  };
}

export function stripHtml(html: string | null | undefined, max = 160): string {
  if (!html) return "";
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
