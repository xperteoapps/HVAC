import { Link } from "react-router-dom";
import { BadgePercent, Clock, FileText, Truck, CheckCircle2 } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const BENEFITS = [
  { icon: BadgePercent, title: "Ceny netto i rabaty grupowe", text: "Po weryfikacji konta widzisz ceny netto z rabatem przypisanym do Twojej grupy." },
  { icon: Clock, title: "Płatność odroczona 14 dni", text: "Dla stałych klientów — zamówienie realizujemy od razu, faktura z terminem 14 dni." },
  { icon: FileText, title: "Faktury VAT", text: "Każde zamówienie z fakturą VAT na dane firmy zapisane w koncie." },
  { icon: Truck, title: "Dostawa paletowa i odbiór osobisty", text: "Darmowa dostawa od progu B2B, odbiór w magazynie po potwierdzeniu." },
];

export default function B2B() {
  const { user, profile, isB2B } = useAuth();
  const pending = Boolean(profile?.b2b_requested && !profile.b2b_approved);
  return (
    <div>
      <Seo title="Strefa B2B dla instalatorów" description="Konto B2B dla firm instalacyjnych: ceny netto, rabaty grupowe, płatność odroczona 14 dni, faktury VAT." path="/b2b" />
      <Breadcrumbs items={[{ name: "Strefa B2B", path: "/b2b" }]} />
      <div className="rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
        <h1 className="text-3xl font-bold sm:text-4xl">Współpraca B2B dla firm instalacyjnych</h1>
        <p className="mt-3 max-w-2xl text-primary-foreground/80">
          Zarejestruj firmę, podaj NIP, a po weryfikacji otrzymasz dostęp do cen hurtowych, rabatów i płatności odroczonej.
        </p>
        <div className="mt-6">
          {isB2B ? (
            <p className="flex items-center gap-2 font-medium text-accent">
              <CheckCircle2 className="h-5 w-5" /> Twoje konto B2B jest aktywne.
            </p>
          ) : pending ? (
            <p className="flex items-center gap-2 font-medium text-accent">
              <Clock className="h-5 w-5" /> Wniosek o konto B2B oczekuje na weryfikację.
            </p>
          ) : user ? (
            <Button variant="accent" size="lg" asChild>
              <Link to="/konto/firma">Uzupełnij dane firmy i złóż wniosek</Link>
            </Button>
          ) : (
            <Button variant="accent" size="lg" asChild>
              <Link to="/rejestracja?next=/konto/firma">Załóż konto firmowe</Link>
            </Button>
          )}
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div key={b.title} className="flex gap-4 rounded-lg border bg-card p-5">
            <b.icon className="h-7 w-7 shrink-0 text-accent" />
            <div>
              <h2 className="font-semibold">{b.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{b.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Jak to działa?</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          <li>Załóż konto i w zakładce „Dane firmy” podaj nazwę firmy oraz NIP.</li>
          <li>Weryfikujemy wniosek (zwykle do 1 dnia roboczego) i przypisujemy grupę rabatową.</li>
          <li>Po zatwierdzeniu ceny w sklepie wyświetlają się netto z rabatem; w koszyku możesz wybrać płatność odroczoną, jeśli została włączona dla Twojej firmy.</li>
        </ol>
      </div>
    </div>
  );
}
