import { Link } from "react-router-dom";
import { Wind } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useStaticPages } from "@/hooks/useStaticPage";
import { SITE_NAME } from "@/lib/seo";

export function Footer() {
  const { data } = useCategories();
  const { data: pages } = useStaticPages();
  return (
    <footer className="mt-12 border-t bg-primary text-primary-foreground">
      <div className="container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <Wind className="h-5 w-5 text-accent" /> {SITE_NAME}
          </div>
          <p className="mt-3 text-sm text-primary-foreground/70">
            Klimatyzacja, pompy ciepła, wentylacja i akcesoria montażowe. Obsługa klientów indywidualnych i firm instalacyjnych (B2B).
          </p>
          {/* TODO(ustalić): dane sprzedawcy (nazwa, adres, NIP) po dostarczeniu przez klienta */}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground/60">Kategorie</h3>
          <ul className="space-y-1.5 text-sm">
            {(data?.tree ?? []).map((c) => (
              <li key={c.id}>
                <Link to={`/kategoria/${c.slug}`} className="hover:text-accent">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground/60">Informacje</h3>
          <ul className="space-y-1.5 text-sm">
            {(pages ?? []).map((p) => (
              <li key={p.slug}>
                <Link to={`/strona/${p.slug}`} className="hover:text-accent">
                  {p.title}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/b2b" className="hover:text-accent">
                Współpraca B2B
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground/60">Konto</h3>
          <ul className="space-y-1.5 text-sm">
            <li>
              <Link to="/logowanie" className="hover:text-accent">
                Logowanie
              </Link>
            </li>
            <li>
              <Link to="/rejestracja" className="hover:text-accent">
                Rejestracja
              </Link>
            </li>
            <li>
              <Link to="/konto/zamowienia" className="hover:text-accent">
                Moje zamówienia
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col gap-2 py-4 text-xs text-primary-foreground/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {SITE_NAME}. Wszystkie ceny w PLN.</span>
          <span>Płatność: przelew tradycyjny · B2B: płatność odroczona 14 dni</span>
        </div>
      </div>
    </footer>
  );
}
