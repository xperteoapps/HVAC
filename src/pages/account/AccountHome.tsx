import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrders } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { phoneSchema } from "@/lib/validators";
import { formatDate, formatPrice, ORDER_STATUS_LABELS } from "@/lib/formatters";

const schema = z.object({ full_name: z.string().trim().min(3, "Podaj imię i nazwisko"), phone: phoneSchema.optional().or(z.literal("")) });
type Values = z.infer<typeof schema>;

export default function AccountHome() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: orders } = useMyOrders(user?.id);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { full_name: "", phone: "" } });

  useEffect(() => {
    if (profile) reset({ full_name: profile.full_name ?? "", phone: profile.phone ?? "" });
  }, [profile, reset]);

  const onSubmit = async (v: Values) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: v.full_name, phone: v.phone || null }).eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Dane zapisane");
      await refreshProfile();
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Dane podstawowe</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField label="Imię i nazwisko" required error={errors.full_name?.message} htmlFor="full_name">
              <Input id="full_name" {...register("full_name")} />
            </FormField>
            <FormField label="Telefon" error={errors.phone?.message} htmlFor="phone">
              <Input id="phone" type="tel" {...register("phone")} />
            </FormField>
            <Button type="submit" disabled={isSubmitting}>
              Zapisz
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ostatnie zamówienia</CardTitle>
          <CardDescription>
            <Link to="/konto/zamowienia" className="text-accent underline">
              Zobacz wszystkie
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders && orders.length > 0 ? (
            <ul className="divide-y text-sm">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/konto/zamowienia/${o.id}`} className="font-medium hover:text-accent">
                    {o.number}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                  <span className="text-xs">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                  <span className="font-semibold">{formatPrice(o.total_gross_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nie masz jeszcze zamówień.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
