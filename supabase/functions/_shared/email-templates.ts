// Szablony e-maili transakcyjnych (HTML + tekst), po polsku, bez zewnętrznych zasobów.
// Nazwa i adres sklepu z env SHOP_NAME / SHOP_URL (branding klienta — TODO(ustalić)).

import { formatPln } from "./pricing.ts";

export interface EmailAddress {
  full_name?: string | null;
  company_name?: string | null;
  street?: string | null;
  building_no?: string | null;
  apartment_no?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  nip?: string | null;
}

/** Dane zamówienia potrzebne szablonom (podzbiór wiersza `orders` + nazwa metody dostawy). */
export interface EmailOrder {
  id: string;
  number: string;
  email: string;
  status: string;
  payment_status: string;
  price_mode: "gross" | "net";
  customer_group_code?: string | null;
  subtotal_net_cents: number;
  shipping_net_cents: number;
  vat_cents: number;
  total_gross_cents: number;
  shipping_method: string | null;
  /** czytelna nazwa metody dostawy (jeśli znana) */
  shipping_method_name?: string | null;
  shipping_address: EmailAddress | null;
  billing_address?: EmailAddress | null;
  invoice_requested?: boolean;
  nip?: string | null;
  notes?: string | null;
  payment_due_date?: string | null;
  created_at: string;
}

export interface EmailOrderItem {
  sku: string;
  name: string;
  qty: number;
  /** cena jednostkowa netto po rabacie */
  price_net_cents: number;
  vat_rate: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function shopName(): string {
  return Deno.env.get("SHOP_NAME") || "Sklep HVAC";
}

export function shopUrl(): string {
  return (Deno.env.get("SHOP_URL") || "").replace(/\/+$/, "");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = {
  body: "margin:0;padding:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif;color:#0F172A;",
  wrap: "max-width:640px;margin:0 auto;padding:24px 16px;",
  card: "background:#ffffff;border:1px solid #E2E8F0;border-radius:8px;padding:24px;",
  h1: "font-size:20px;margin:0 0 16px 0;color:#0F172A;",
  h2: "font-size:16px;margin:24px 0 8px 0;color:#0F172A;",
  p: "font-size:14px;line-height:1.5;margin:0 0 12px 0;",
  muted: "font-size:12px;color:#64748B;line-height:1.5;margin:16px 0 0 0;",
  table: "width:100%;border-collapse:collapse;font-size:13px;",
  th: "text-align:left;padding:8px;border-bottom:1px solid #E2E8F0;color:#64748B;font-weight:normal;",
  td: "padding:8px;border-bottom:1px solid #F1F5F9;vertical-align:top;",
  tdNum: "padding:8px;border-bottom:1px solid #F1F5F9;text-align:right;white-space:nowrap;",
  box: "background:#F8FAFC;border-left:4px solid #0EA5E9;padding:12px 16px;margin:16px 0;font-size:14px;line-height:1.6;",
  button:
    "display:inline-block;background:#0EA5E9;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;",
} as const;

function layout(title: string, bodyHtml: string): string {
  const name = escapeHtml(shopName());
  return `<!doctype html>
<html lang="pl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="${STYLE.body}">
  <div style="${STYLE.wrap}">
    <div style="font-size:18px;font-weight:bold;margin-bottom:16px;">${name}</div>
    <div style="${STYLE.card}">
      ${bodyHtml}
    </div>
    <p style="${STYLE.muted}">Wiadomość wygenerowana automatycznie przez ${name}. Prosimy na nią nie odpowiadać.</p>
  </div>
</body>
</html>`;
}

function formatAddress(a: EmailAddress | null | undefined): string[] {
  if (!a) return [];
  const lines: string[] = [];
  if (a.full_name) lines.push(a.full_name);
  if (a.company_name) lines.push(a.company_name);
  if (a.nip) lines.push(`NIP: ${a.nip}`);
  const street = [a.street, a.building_no].filter(Boolean).join(" ");
  const streetLine = a.apartment_no ? `${street}/${a.apartment_no}` : street;
  if (streetLine) lines.push(streetLine);
  const cityLine = [a.postal_code, a.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (a.country && a.country !== "PL") lines.push(a.country);
  if (a.phone) lines.push(`tel. ${a.phone}`);
  return lines;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

function paymentStatusLabel(order: EmailOrder): string {
  if (order.payment_status === "deferred") {
    return `płatność odroczona — termin ${formatDate(order.payment_due_date)}`;
  }
  if (order.payment_status === "paid") return "opłacone";
  return "oczekuje na płatność (przelew tradycyjny)";
}

function itemsTableHtml(order: EmailOrder, items: EmailOrderItem[]): string {
  const net = order.price_mode === "net";
  const rows = items.map((it) => {
    const lineNet = it.price_net_cents * it.qty;
    const lineGross = lineNet + Math.round(lineNet * it.vat_rate / 100);
    const unit = net ? it.price_net_cents : it.price_net_cents + Math.round(it.price_net_cents * it.vat_rate / 100);
    const line = net ? lineNet : lineGross;
    return `<tr>
      <td style="${STYLE.td}">${escapeHtml(it.name)}<br><span style="color:#64748B;">SKU: ${escapeHtml(it.sku)}</span></td>
      <td style="${STYLE.tdNum}">${it.qty} szt.</td>
      <td style="${STYLE.tdNum}">${formatPln(unit)}</td>
      <td style="${STYLE.tdNum}">${formatPln(line)}</td>
    </tr>`;
  }).join("");
  const priceHead = net ? "Cena netto" : "Cena brutto";
  const valueHead = net ? "Wartość netto" : "Wartość brutto";
  return `<table style="${STYLE.table}">
    <thead><tr>
      <th style="${STYLE.th}">Produkt</th>
      <th style="${STYLE.th};text-align:right;">Ilość</th>
      <th style="${STYLE.th};text-align:right;">${priceHead}</th>
      <th style="${STYLE.th};text-align:right;">${valueHead}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totalsHtml(order: EmailOrder): string {
  const shippingName = order.shipping_method_name || order.shipping_method || "—";
  const shippingVat = Math.round(order.shipping_net_cents * 23 / 100);
  const shippingLabel = order.price_mode === "net"
    ? formatPln(order.shipping_net_cents)
    : formatPln(order.shipping_net_cents + shippingVat);
  return `<table style="${STYLE.table};margin-top:12px;">
    <tr><td style="${STYLE.td}">Wartość produktów netto</td><td style="${STYLE.tdNum}">${formatPln(order.subtotal_net_cents)}</td></tr>
    <tr><td style="${STYLE.td}">Dostawa (${escapeHtml(shippingName)})</td><td style="${STYLE.tdNum}">${shippingLabel}</td></tr>
    <tr><td style="${STYLE.td}">VAT</td><td style="${STYLE.tdNum}">${formatPln(order.vat_cents)}</td></tr>
    <tr><td style="${STYLE.td};font-weight:bold;">Razem do zapłaty brutto</td><td style="${STYLE.tdNum};font-weight:bold;">${formatPln(order.total_gross_cents)}</td></tr>
  </table>`;
}

function itemsTableText(order: EmailOrder, items: EmailOrderItem[]): string {
  const net = order.price_mode === "net";
  return items.map((it) => {
    const lineNet = it.price_net_cents * it.qty;
    const line = net ? lineNet : lineNet + Math.round(lineNet * it.vat_rate / 100);
    return `- ${it.name} (SKU ${it.sku}) x ${it.qty} = ${formatPln(line)} ${net ? "netto" : "brutto"}`;
  }).join("\n");
}

function totalsText(order: EmailOrder): string {
  const shippingName = order.shipping_method_name || order.shipping_method || "—";
  return [
    `Wartość produktów netto: ${formatPln(order.subtotal_net_cents)}`,
    `Dostawa (${shippingName}): ${formatPln(order.shipping_net_cents)} netto`,
    `VAT: ${formatPln(order.vat_cents)}`,
    `RAZEM DO ZAPŁATY BRUTTO: ${formatPln(order.total_gross_cents)}`,
  ].join("\n");
}

/** Potwierdzenie zamówienia dla klienta (z instrukcją płatności). */
export function orderConfirmationCustomer(
  order: EmailOrder,
  items: EmailOrderItem[],
  paymentInstructions: string | null | undefined,
): RenderedEmail {
  const name = shopName();
  const url = shopUrl();
  const subject = `Potwierdzenie zamówienia ${order.number} — ${name}`;
  const ship = formatAddress(order.shipping_address);
  const bill = formatAddress(order.billing_address);
  const customerName = order.shipping_address?.full_name || "";

  const html = layout(subject, `
    <h1 style="${STYLE.h1}">Dziękujemy za zamówienie ${escapeHtml(order.number)}</h1>
    <p style="${STYLE.p}">${customerName ? `Dzień dobry, ${escapeHtml(customerName)}!` : "Dzień dobry!"} Otrzymaliśmy Twoje zamówienie z dnia ${formatDate(order.created_at)}. Poniżej znajdziesz jego podsumowanie.</p>
    <p style="${STYLE.p}"><strong>Status płatności:</strong> ${escapeHtml(paymentStatusLabel(order))}</p>
    ${paymentInstructions ? `<div style="${STYLE.box}">${escapeHtml(paymentInstructions).replace(/\n/g, "<br>")}</div>` : ""}
    <h2 style="${STYLE.h2}">Zamówione produkty</h2>
    ${itemsTableHtml(order, items)}
    ${totalsHtml(order)}
    <h2 style="${STYLE.h2}">Adres dostawy</h2>
    <p style="${STYLE.p}">${ship.map(escapeHtml).join("<br>") || "—"}</p>
    ${bill.length ? `<h2 style="${STYLE.h2}">Dane do faktury</h2><p style="${STYLE.p}">${bill.map(escapeHtml).join("<br>")}</p>` : ""}
    ${order.invoice_requested ? `<p style="${STYLE.p}">Do zamówienia zostanie wystawiona faktura VAT${order.nip ? ` (NIP ${escapeHtml(order.nip)})` : ""}.</p>` : ""}
    ${order.notes ? `<h2 style="${STYLE.h2}">Uwagi do zamówienia</h2><p style="${STYLE.p}">${escapeHtml(order.notes)}</p>` : ""}
    ${url ? `<p style="${STYLE.p};margin-top:24px;"><a href="${escapeHtml(url)}/konto/zamowienia" style="${STYLE.button}">Zobacz zamówienie</a></p>` : ""}
    <p style="${STYLE.muted}">O zmianie statusu zamówienia poinformujemy Cię osobną wiadomością. W razie pytań odpowiedz na ten e-mail lub skontaktuj się z nami przez stronę sklepu.</p>
  `);

  const text = [
    `Dziękujemy za zamówienie ${order.number} — ${name}`,
    "",
    `Data: ${formatDate(order.created_at)}`,
    `Status płatności: ${paymentStatusLabel(order)}`,
    "",
    paymentInstructions ? `${paymentInstructions}\n` : "",
    "Zamówione produkty:",
    itemsTableText(order, items),
    "",
    totalsText(order),
    "",
    "Adres dostawy:",
    ship.join("\n") || "—",
    bill.length ? `\nDane do faktury:\n${bill.join("\n")}` : "",
    order.notes ? `\nUwagi: ${order.notes}` : "",
    url ? `\nZamówienia: ${url}/konto/zamowienia` : "",
  ].filter((line) => line !== "").join("\n");

  return { subject, html, text };
}

/** Powiadomienie dla obsługi sklepu o nowym zamówieniu. */
export function orderNotificationAdmin(order: EmailOrder, items: EmailOrderItem[]): RenderedEmail {
  const name = shopName();
  const url = shopUrl();
  const subject = `Nowe zamówienie ${order.number} — ${formatPln(order.total_gross_cents)}`;
  const ship = formatAddress(order.shipping_address);
  const bill = formatAddress(order.billing_address);

  const html = layout(subject, `
    <h1 style="${STYLE.h1}">Nowe zamówienie ${escapeHtml(order.number)}</h1>
    <p style="${STYLE.p}">
      <strong>Klient:</strong> ${escapeHtml(order.email)}<br>
      <strong>Grupa:</strong> ${escapeHtml(order.customer_group_code || "b2c")} (${order.price_mode === "net" ? "ceny netto" : "ceny brutto"})<br>
      <strong>Status:</strong> ${escapeHtml(order.status)} / ${escapeHtml(paymentStatusLabel(order))}<br>
      <strong>Dostawa:</strong> ${escapeHtml(order.shipping_method_name || order.shipping_method || "—")}
    </p>
    ${itemsTableHtml(order, items)}
    ${totalsHtml(order)}
    <h2 style="${STYLE.h2}">Adres dostawy</h2>
    <p style="${STYLE.p}">${ship.map(escapeHtml).join("<br>") || "—"}</p>
    ${bill.length ? `<h2 style="${STYLE.h2}">Dane do faktury</h2><p style="${STYLE.p}">${bill.map(escapeHtml).join("<br>")}</p>` : ""}
    ${order.invoice_requested ? `<p style="${STYLE.p}"><strong>Klient prosi o fakturę VAT</strong>${order.nip ? ` — NIP ${escapeHtml(order.nip)}` : ""}.</p>` : ""}
    ${order.notes ? `<h2 style="${STYLE.h2}">Uwagi klienta</h2><p style="${STYLE.p}">${escapeHtml(order.notes)}</p>` : ""}
    ${url ? `<p style="${STYLE.p};margin-top:24px;"><a href="${escapeHtml(url)}/admin/zamowienia/${escapeHtml(order.id)}" style="${STYLE.button}">Otwórz w panelu</a></p>` : ""}
  `);

  const text = [
    `Nowe zamówienie ${order.number} — ${name}`,
    "",
    `Klient: ${order.email}`,
    `Grupa: ${order.customer_group_code || "b2c"} (${order.price_mode === "net" ? "ceny netto" : "ceny brutto"})`,
    `Status: ${order.status} / ${paymentStatusLabel(order)}`,
    `Dostawa: ${order.shipping_method_name || order.shipping_method || "—"}`,
    "",
    itemsTableText(order, items),
    "",
    totalsText(order),
    "",
    "Adres dostawy:",
    ship.join("\n") || "—",
    bill.length ? `\nDane do faktury:\n${bill.join("\n")}` : "",
    order.invoice_requested ? `\nKlient prosi o fakturę VAT${order.nip ? ` — NIP ${order.nip}` : ""}.` : "",
    order.notes ? `\nUwagi klienta: ${order.notes}` : "",
    url ? `\nPanel: ${url}/admin/zamowienia/${order.id}` : "",
  ].filter((line) => line !== "").join("\n");

  return { subject, html, text };
}

/** Alert dla admina o nieudanej synchronizacji hurtowni. */
export function syncFailedAdmin(supplierName: string, error: string): RenderedEmail {
  const name = shopName();
  const url = shopUrl();
  const subject = `Błąd synchronizacji hurtowni: ${supplierName}`;
  const html = layout(subject, `
    <h1 style="${STYLE.h1}">Synchronizacja hurtowni „${escapeHtml(supplierName)}” nie powiodła się</h1>
    <p style="${STYLE.p}">Ostatni przebieg synchronizacji zakończył się błędem. Ceny i stany z tej hurtowni mogą być nieaktualne do czasu kolejnego udanego przebiegu.</p>
    <div style="${STYLE.box}"><code style="white-space:pre-wrap;font-size:12px;">${escapeHtml(error)}</code></div>
    ${url ? `<p style="${STYLE.p}"><a href="${escapeHtml(url)}/admin/hurtownie" style="${STYLE.button}">Otwórz panel hurtowni</a></p>` : ""}
  `);
  const text = [
    `Synchronizacja hurtowni „${supplierName}” nie powiodła się — ${name}`,
    "",
    "Ostatni przebieg synchronizacji zakończył się błędem:",
    error,
    url ? `\nPanel: ${url}/admin/hurtownie` : "",
  ].filter((line) => line !== "").join("\n");
  return { subject, html, text };
}

/** Informacja dla klienta o zatwierdzeniu konta B2B. */
export function b2bApproved(name: string | null | undefined): RenderedEmail {
  const shop = shopName();
  const url = shopUrl();
  const subject = `Twoje konto B2B zostało zatwierdzone — ${shop}`;
  const greeting = name ? `Dzień dobry, ${escapeHtml(name)}!` : "Dzień dobry!";
  const html = layout(subject, `
    <h1 style="${STYLE.h1}">Konto B2B aktywne</h1>
    <p style="${STYLE.p}">${greeting} Twoje konto firmowe w sklepie ${escapeHtml(shop)} zostało zatwierdzone.</p>
    <p style="${STYLE.p}">Od teraz po zalogowaniu widzisz ceny netto z rabatem przypisanym do Twojej grupy klienta. Jeśli przyznaliśmy Ci płatność odroczoną, opcja „płatność odroczona 14 dni” pojawi się w podsumowaniu zamówienia.</p>
    ${url ? `<p style="${STYLE.p};margin-top:24px;"><a href="${escapeHtml(url)}" style="${STYLE.button}">Przejdź do sklepu</a></p>` : ""}
  `);
  const text = [
    `Konto B2B aktywne — ${shop}`,
    "",
    `${name ? `Dzień dobry, ${name}!` : "Dzień dobry!"} Twoje konto firmowe zostało zatwierdzone.`,
    "Po zalogowaniu widzisz ceny netto z rabatem przypisanym do Twojej grupy klienta.",
    "Jeśli przyznaliśmy Ci płatność odroczoną, opcja „płatność odroczona 14 dni” pojawi się w podsumowaniu zamówienia.",
    url ? `\nSklep: ${url}` : "",
  ].filter((line) => line !== "").join("\n");
  return { subject, html, text };
}
