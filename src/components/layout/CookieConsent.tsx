import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Zgoda na cookies zgodna z Google Consent Mode v2.
 * Wysyła `gtag('consent', 'update', ...)` jeśli gtag istnieje (tag GTM/GA dodamy po decyzji klienta).
 */
const KEY = "hvac-consent-v1";

interface Consent {
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

type Gtag = (...args: unknown[]) => void;

function applyConsent(c: Consent) {
  const w = window as unknown as { gtag?: Gtag; dataLayer?: unknown[] };
  const payload = {
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: c.marketing ? "granted" : "denied",
    analytics_storage: c.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  };
  if (typeof w.gtag === "function") w.gtag("consent", "update", payload);
  else (w.dataLayer = w.dataLayer || []).push({ event: "consent_update", ...payload });
}

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = readConsent();
    if (saved) applyConsent(saved);
    else setVisible(true);
  }, []);

  const save = (c: Omit<Consent, "ts">) => {
    const consent = { ...c, ts: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(consent));
    } catch {
      /* ignore */
    }
    applyConsent(consent);
    setVisible(false);
  };

  if (!visible) return null;
  return (
    <div role="dialog" aria-label="Zgoda na pliki cookies" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-2xl">
      <div className="container flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          <p className="font-medium">Używamy plików cookies</p>
          <p className="text-muted-foreground">
            Niezbędne do działania sklepu oraz — za Twoją zgodą — analityczne i marketingowe.{" "}
            <Link to="/strona/polityka-prywatnosci" className="underline">
              Polityka prywatności
            </Link>
          </p>
          {details && (
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked disabled /> Niezbędne (zawsze aktywne)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={analytics} onCheckedChange={(v) => setAnalytics(Boolean(v))} /> Analityczne
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(Boolean(v))} /> Marketingowe
              </label>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {details ? (
            <Button variant="outline" size="sm" onClick={() => save({ analytics, marketing })}>
              Zapisz wybór
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDetails(true)}>
              Ustawienia
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => save({ analytics: false, marketing: false })}>
            Tylko niezbędne
          </Button>
          <Button size="sm" onClick={() => save({ analytics: true, marketing: true })}>
            Akceptuję wszystkie
          </Button>
        </div>
      </div>
    </div>
  );
}
