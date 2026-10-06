import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isValidNip } from "@/lib/validators";

const schema = z.object({
  company_name: z.string().trim().min(2, "Podaj nazwę firmy"),
  nip: z.string().trim().refine(isValidNip, "Nieprawidłowy NIP (10 cyfr)"),
});
type Values = z.infer<typeof schema>;

export default function CompanyData() {
  const { user, profile, isB2B, refreshProfile } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { company_name: "", nip: "" } });
  const pending = Boolean(profile?.b2b_requested && !profile.b2b_approved);

  useEffect(() => {
    if (profile) reset({ company_name: profile.company_name ?? "", nip: profile.nip ?? "" });
  }, [profile, reset]);

  const onSubmit = async (v: Values) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ company_name: v.company_name, nip: v.nip.replace(/[\s-]/g, ""), b2b_requested: true })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success(isB2B ? "Dane firmy zapisane" : "Wniosek o konto B2B został wysłany");
      await refreshProfile();
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dane firmy</CardTitle>
          <CardDescription>Dane do faktur VAT. Podanie NIP jest jednocześnie wnioskiem o konto B2B.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField label="Nazwa firmy" required error={errors.company_name?.message} htmlFor="company_name">
              <Input id="company_name" {...register("company_name")} />
            </FormField>
            <FormField label="NIP" required error={errors.nip?.message} htmlFor="nip">
              <Input id="nip" inputMode="numeric" {...register("nip")} />
            </FormField>
            <Button type="submit" disabled={isSubmitting}>
              {isB2B ? "Zapisz" : "Zapisz i złóż wniosek B2B"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Status konta B2B</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isB2B ? (
            <>
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="h-5 w-5" /> Konto B2B aktywne
              </p>
              <p>
                Grupa: <strong>{profile?.customer_group?.name}</strong> · rabat {profile?.customer_group?.discount_pct ?? 0}%
              </p>
              <p>Płatność odroczona 14 dni: {profile?.deferred_payment_allowed ? <strong>włączona</strong> : "niedostępna — skontaktuj się z opiekunem"}</p>
            </>
          ) : pending ? (
            <p className="flex items-center gap-2 font-medium text-accent">
              <Clock className="h-5 w-5" /> Wniosek oczekuje na weryfikację (zwykle do 1 dnia roboczego).
            </p>
          ) : (
            <p className="text-muted-foreground">Uzupełnij dane firmy i NIP, aby złożyć wniosek o ceny B2B, rabaty i płatność odroczoną.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
