// Wysyłka e-maili przez Resend (REST). Nigdy nie rzuca — błąd e-maila nie może
// zablokować złożenia zamówienia; wynik trzeba sprawdzić po stronie wywołującego.

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string };

const RESEND_URL = "https://api.resend.com/emails";

export function emailFrom(): string {
  return Deno.env.get("EMAIL_FROM") || "Sklep HVAC <zamowienia@example.com>";
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Array.isArray(args.to) ? args.to : [args.to];
  const recipients = to.map((t) => t.trim()).filter((t) => t.length > 0);

  if (recipients.length === 0) {
    console.warn("[resend] brak odbiorcy — pomijam wysyłkę:", args.subject);
    return { ok: false, skipped: true, reason: "no_recipient" };
  }
  if (!apiKey) {
    console.warn("[resend] brak RESEND_API_KEY — pomijam wysyłkę:", args.subject, "→", recipients.join(", "));
    return { ok: false, skipped: true, reason: "missing_api_key" };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: recipients,
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `Resend HTTP ${res.status}: ${body.slice(0, 500)}`;
      console.error("[resend]", error);
      return { ok: false, error };
    }

    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, id: json?.id ?? null };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[resend] wyjątek podczas wysyłki:", error);
    return { ok: false, error };
  }
}
