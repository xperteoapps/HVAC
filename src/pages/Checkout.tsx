import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { AddressForm } from "@/components/checkout/AddressForm";
import { ShippingSelector } from "@/components/checkout/ShippingSelector";
import { PaymentSelector, type PaymentChoice } from "@/components/checkout/PaymentSelector";
import { OrderReview } from "@/components/checkout/OrderReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useShippingOptions, extractFunctionError } from "@/hooks/useShipping";
import { useMyAddresses } from "@/hooks/useOrders";
import { useCartStore } from "@/lib/cart-store";
import { addressSchema, emailSchema, nipSchema, phoneSchema } from "@/lib/validators";
import { supabase } from "@/integrations/supabase/client";
import type { CreatedOrder } from "@/types";

/** Adres do faktury bez reguł — pełna walidacja (addressSchema) tylko gdy zaznaczono „Inne dane do faktury”. */
const looseAddressSchema = z
  .object({
    full_name: z.string(),
    company_name: z.string(),
    street: z.string(),
    building_no: z.string(),
    apartment_no: z.string(),
    postal_code: z.string(),
    city: z.string(),
    country: z.string(),
    phone: z.string(),
  })
  .partial();

const checkoutSchema = z
  .object({
    email: emailSchema,
    full_name: z.string().trim().min(3, "Podaj imię i nazwisko"),
    phone: phoneSchema,
    shipping: addressSchema,
    different_billing: z.boolean().default(false),
    // Walidowany tylko, gdy klient zaznaczy „Inne dane do faktury” (superRefine poniżej)
    billing: looseAddressSchema.optional(),
    invoice_requested: z.boolean().default(false),
    nip: nipSchema.optional().or(z.literal("")),
    shipping_method_code: z.string().min(1, "Wybierz metodę dostawy"),
    payment: z.enum(["manual", "imoje", "deferred"]),
    notes: z.string().max(1000).optional().or(z.literal("")),
    terms: z.literal(true, { errorMap: () => ({ message: "Akceptacja regulaminu jest wymagana" }) }),
    privacy: z.literal(true, { errorMap: () => ({ message: "Zgoda jest wymagana" }) }),
    marketing: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.invoice_requested && (!v.nip || v.nip.trim() === "")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nip"], message: "Podaj NIP do faktury" });
    }
    if (v.different_billing) {
      const billing = addressSchema.safeParse(v.billing ?? {});
      if (!billing.success) {
        for (const issue of billing.error.issues) ctx.addIssue({ ...issue, path: ["billing", ...issue.path] });
      }
    }
  });

type CheckoutValues = z.infer<typeof checkoutSchema>;

const emptyAddress = { full_name: "", company_name: "", street: "", building_no: "", apartment_no: "", postal_code: "", city: "", country: "PL", phone: "" };

export const ORDER_CONFIRM_KEY = "hvac-last-order";

export default function Checkout() {
  const navigate = useNavigate();
  const { user, profile, isB2B } = useAuth();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const sessionId = useCartStore((s) => s.sessionId);
  const { data: addresses } = useMyAddresses(user?.id);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      email: "",
      full_name: "",
      phone: "",
      shipping: { ...emptyAddress },
      different_billing: false,
      billing: { ...emptyAddress },
      invoice_requested: false,
      nip: "",
      shipping_method_code: "",
      payment: "manual",
      notes: "",
      marketing: false,
    },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;

  // Prefill z profilu i domyślnego adresu
  useEffect(() => {
    if (!user) return;
    if (!watch("email")) setValue("email", user.email ?? "");
    if (profile) {
      if (!watch("full_name") && profile.full_name) setValue("full_name", profile.full_name);
      if (!watch("phone") && profile.phone) setValue("phone", profile.phone);
      if (!watch("nip") && profile.nip) {
        setValue("nip", profile.nip);
        setValue("invoice_requested", true);
      }
      if (profile.company_name && !watch("shipping.company_name")) setValue("shipping.company_name", profile.company_name);
    }
    const def = addresses?.find((a) => a.type === "shipping" && a.is_default) ?? addresses?.find((a) => a.type === "shipping");
    if (def && !watch("shipping.street")) {
      setValue("shipping", {
        full_name: def.full_name,
        company_name: def.company_name ?? "",
        street: def.street,
        building_no: def.building_no,
        apartment_no: def.apartment_no ?? "",
        postal_code: def.postal_code,
        city: def.city,
        country: def.country,
        phone: def.phone ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, addresses]);

  const shippingInput = useMemo(() => (items.length ? { items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })), postal_code: undefined } : null), [items]);
  const { data: shipping, isLoading: shippingLoading, error: shippingError } = useShippingOptions(shippingInput);
  const selectedCode = watch("shipping_method_code");
  const selectedShipping = shipping?.options.find((o) => o.code === selectedCode);

  // Domyślnie pierwsza dostępna metoda
  useEffect(() => {
    if (shipping && shipping.options.length && !shipping.options.some((o) => o.code === selectedCode)) {
      setValue("shipping_method_code", shipping.options[0].code);
    }
  }, [shipping, selectedCode, setValue]);

  const differentBilling = watch("different_billing");
  const invoiceRequested = watch("invoice_requested");
  const payment = watch("payment") as PaymentChoice;
  const deferredAllowed = Boolean(isB2B && profile?.deferred_payment_allowed);
  const enabledProviders = shipping?.payment_providers ?? ["manual"];

  // Domyślnie płatność online, jeśli bramka jest włączona
  useEffect(() => {
    if (enabledProviders.includes("imoje") && payment === "manual" && !form.formState.dirtyFields.payment) {
      setValue("payment", "imoje");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledProviders.join(",")]);

  if (items.length === 0) {
    return (
      <EmptyState title="Koszyk jest pusty" description="Dodaj produkty, aby złożyć zamówienie." action={<Button asChild><Link to="/">Wróć do sklepu</Link></Button>} />
    );
  }

  const onInvalid = () => {
    toast.error("Uzupełnij wymagane pola zamówienia");
    // Przewiń do pierwszego pola z błędem
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[role=alert]")?.closest("div")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const onSubmit = async (values: CheckoutValues) => {
    setSubmitting(true);
    try {
      const body = {
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        customer: { email: values.email, full_name: values.full_name, phone: values.phone },
        shipping_address: clean(values.shipping),
        billing_address: values.different_billing && values.billing ? { ...clean(values.billing), nip: values.nip || undefined } : undefined,
        invoice_requested: values.invoice_requested,
        nip: values.nip || undefined,
        shipping_method_code: values.shipping_method_code,
        payment_provider: values.payment === "imoje" ? ("imoje" as const) : ("manual" as const),
        deferred_payment: values.payment === "deferred",
        notes: values.notes || undefined,
        consents: { terms: true as const, privacy: true as const, marketing: values.marketing },
        session_id: sessionId,
      };
      const { data, error } = await supabase.functions.invoke<CreatedOrder>("create-order", { body });
      if (error) throw new Error(await extractFunctionError(error, "Nie udało się złożyć zamówienia"));
      if (!data?.order) throw new Error("Nieprawidłowa odpowiedź serwera");
      try {
        sessionStorage.setItem(ORDER_CONFIRM_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
      clearCart();
      if (data.payment?.warning) toast.warning(data.payment.warning);
      if (data.payment?.redirectUrl) {
        // Przekierowanie do bramki imoje; po płatności wracamy na stronę potwierdzenia.
        window.location.assign(data.payment.redirectUrl);
        return;
      }
      navigate(`/zamowienie/potwierdzenie/${encodeURIComponent(data.order.number)}`, { state: data });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się złożyć zamówienia");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Seo title="Zamówienie" noindex />
      <PageHeader title="Zamówienie" description={user ? undefined : "Możesz zamówić jako gość lub zalogować się, aby zapisać dane."} actions={!user ? <Button variant="outline" size="sm" asChild><Link to="/logowanie?next=/zamowienie">Zaloguj się</Link></Button> : undefined} />
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" noValidate>
        <div className="space-y-8">
          <Section step={1} title="Dane kontaktowe">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="E-mail" required error={errors.email?.message} htmlFor="email" className="sm:col-span-2">
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
              </FormField>
              <FormField label="Imię i nazwisko" required error={errors.full_name?.message} htmlFor="full_name">
                <Input id="full_name" autoComplete="name" {...register("full_name")} />
              </FormField>
              <FormField label="Telefon" required error={errors.phone?.message} htmlFor="phone">
                <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} />
              </FormField>
            </div>
          </Section>

          <Section step={2} title="Adres dostawy">
            <AddressForm prefix="shipping" register={register} errors={errors} />
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={invoiceRequested} onCheckedChange={(v) => setValue("invoice_requested", Boolean(v))} /> Chcę otrzymać fakturę VAT na firmę
              </label>
              {invoiceRequested && (
                <FormField label="NIP" required error={errors.nip?.message} htmlFor="nip" className="max-w-xs">
                  <Input id="nip" inputMode="numeric" placeholder="0000000000" {...register("nip")} />
                </FormField>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={differentBilling} onCheckedChange={(v) => setValue("different_billing", Boolean(v))} /> Inne dane do faktury / adres rozliczeniowy
              </label>
            </div>
            {differentBilling && (
              <div className="mt-4 rounded-md border bg-secondary/30 p-4">
                <h3 className="mb-3 text-sm font-semibold">Dane do faktury</h3>
                <AddressForm prefix="billing" register={register} errors={errors} />
              </div>
            )}
          </Section>

          <Section step={3} title="Dostawa">
            <ShippingSelector result={shipping} loading={shippingLoading} error={shippingError ? (shippingError as Error).message : null} value={selectedCode} onChange={(c) => setValue("shipping_method_code", c, { shouldValidate: true })} />
            {errors.shipping_method_code && <p className="mt-2 text-xs text-destructive">{errors.shipping_method_code.message}</p>}
          </Section>

          <Section step={4} title="Płatność">
            <PaymentSelector value={payment} onChange={(v) => setValue("payment", v, { shouldDirty: true })} deferredAllowed={deferredAllowed} enabledProviders={enabledProviders} />
          </Section>

          <Section step={5} title="Uwagi i zgody">
            <FormField label="Uwagi do zamówienia (opcjonalnie)" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={3} placeholder="np. godziny dostawy, numer bramy, prośba o kontakt przed dostawą" {...register("notes")} />
            </FormField>
            <div className="mt-4 space-y-2">
              <ConsentRow error={errors.terms?.message} onChange={(v) => setValue("terms", v as true, { shouldValidate: true })}>
                Akceptuję{" "}
                <Link to="/strona/regulamin" target="_blank" className="underline">
                  regulamin sklepu
                </Link>{" "}
                *
              </ConsentRow>
              <ConsentRow error={errors.privacy?.message} onChange={(v) => setValue("privacy", v as true, { shouldValidate: true })}>
                Zapoznałem się z{" "}
                <Link to="/strona/polityka-prywatnosci" target="_blank" className="underline">
                  polityką prywatności
                </Link>{" "}
                *
              </ConsentRow>
              <ConsentRow onChange={(v) => setValue("marketing", v)}>Chcę otrzymywać informacje o promocjach e-mailem (opcjonalnie)</ConsentRow>
            </div>
          </Section>
        </div>

        <aside className="h-fit rounded-lg border bg-card p-4 lg:sticky lg:top-40">
          <h2 className="mb-3 text-lg font-semibold">Podsumowanie</h2>
          <OrderReview shipping={selectedShipping} />
          <Button type="submit" variant="accent" size="lg" className="mt-4 w-full" disabled={submitting || !shipping}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {payment === "imoje" ? "Zamawiam i przechodzę do płatności" : "Zamawiam i płacę"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Złożenie zamówienia wiąże się z obowiązkiem zapłaty.</p>
        </aside>
      </form>
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ConsentRow({ children, error, onChange }: { children: React.ReactNode; error?: string; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" onCheckedChange={(v) => onChange(Boolean(v))} />
        <span>{children}</span>
      </label>
      {error && (
        <p className="ml-6 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== "" && v !== undefined) out[k] = v;
  return out as T;
}
