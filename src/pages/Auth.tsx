import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema, nipSchema, phoneSchema } from "@/lib/validators";

const loginSchema = z.object({ email: emailSchema, password: z.string().min(6, "Minimum 6 znaków") });
type LoginValues = z.infer<typeof loginSchema>;

function useNext() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/") ? next : "/konto";
}

export function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [magicSent, setMagicSent] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (!loading && user) return <Navigate to={next} replace />;

  const onSubmit = async (v: LoginValues) => {
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Nieprawidłowy e-mail lub hasło" : error.message);
      return;
    }
    navigate(next, { replace: true });
  };

  const magicLink = async () => {
    const email = getValues("email");
    if (!emailSchema.safeParse(email).success) {
      toast.error("Podaj poprawny adres e-mail");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}${next}` } });
    if (error) toast.error(error.message);
    else setMagicSent(true);
  };

  return (
    <div className="mx-auto max-w-md">
      <Seo title="Logowanie" noindex />
      <Card>
        <CardHeader>
          <CardTitle>Logowanie</CardTitle>
          <CardDescription>Zaloguj się, aby śledzić zamówienia i korzystać z cen B2B.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField label="E-mail" required error={errors.email?.message} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
            </FormField>
            <FormField label="Hasło" required error={errors.password?.message} htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            </FormField>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Zaloguj się
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={magicLink} disabled={magicSent}>
              {magicSent ? "Link wysłany — sprawdź skrzynkę" : "Wyślij link do logowania (bez hasła)"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Nie masz konta?{" "}
            <Link to={`/rejestracja?next=${encodeURIComponent(next)}`} className="text-accent underline">
              Zarejestruj się
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const registerSchema = z
  .object({
    full_name: z.string().trim().min(3, "Podaj imię i nazwisko"),
    email: emailSchema,
    phone: phoneSchema.optional().or(z.literal("")),
    password: z.string().min(8, "Minimum 8 znaków"),
    password2: z.string(),
    company_name: z.string().trim().optional().or(z.literal("")),
    nip: nipSchema.optional().or(z.literal("")),
  })
  .refine((v) => v.password === v.password2, { path: ["password2"], message: "Hasła nie są identyczne" });
type RegisterValues = z.infer<typeof registerSchema>;

export function Register() {
  const { user, loading } = useAuth();
  const next = useNext();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  if (!loading && user) return <Navigate to={next} replace />;

  const onSubmit = async (v: RegisterValues) => {
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: { emailRedirectTo: `${window.location.origin}${next}`, data: { full_name: v.full_name, phone: v.phone || null } },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Dane firmy → profil (jeśli sesja istnieje od razu; inaczej uzupełni to konto po potwierdzeniu)
    if (data.session && (v.company_name || v.nip)) {
      await supabase.from("profiles").update({ company_name: v.company_name || null, nip: v.nip || null, b2b_requested: Boolean(v.nip) }).eq("id", data.session.user.id);
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <Seo title="Rejestracja" noindex />
        <Card>
          <CardHeader>
            <CardTitle>Konto utworzone</CardTitle>
            <CardDescription>Jeśli wymagane jest potwierdzenie adresu e-mail, sprawdź skrzynkę i kliknij link aktywacyjny.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to={next}>Przejdź dalej</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Seo title="Rejestracja" noindex />
      <Card>
        <CardHeader>
          <CardTitle>Rejestracja</CardTitle>
          <CardDescription>Załóż konto klienta. Firmy instalacyjne mogą od razu podać NIP, aby złożyć wniosek o konto B2B.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField label="Imię i nazwisko" required error={errors.full_name?.message} htmlFor="full_name">
              <Input id="full_name" autoComplete="name" {...register("full_name")} />
            </FormField>
            <FormField label="E-mail" required error={errors.email?.message} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
            </FormField>
            <FormField label="Telefon" error={errors.phone?.message} htmlFor="phone">
              <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Hasło" required error={errors.password?.message} htmlFor="password">
                <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
              </FormField>
              <FormField label="Powtórz hasło" required error={errors.password2?.message} htmlFor="password2">
                <Input id="password2" type="password" autoComplete="new-password" {...register("password2")} />
              </FormField>
            </div>
            <div className="rounded-md border bg-secondary/30 p-3">
              <p className="mb-3 text-sm font-medium">Dane firmy (opcjonalnie — wniosek o konto B2B)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nazwa firmy" error={errors.company_name?.message} htmlFor="company_name">
                  <Input id="company_name" autoComplete="organization" {...register("company_name")} />
                </FormField>
                <FormField label="NIP" error={errors.nip?.message} htmlFor="nip">
                  <Input id="nip" inputMode="numeric" {...register("nip")} />
                </FormField>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Załóż konto
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Masz już konto?{" "}
            <Link to={`/logowanie?next=${encodeURIComponent(next)}`} className="text-accent underline">
              Zaloguj się
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
