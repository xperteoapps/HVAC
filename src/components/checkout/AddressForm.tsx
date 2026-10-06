import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import type { AddressFormValues } from "@/lib/validators";

type Prefix = "shipping" | "billing";

interface AddressFormProps<T extends Record<Prefix, AddressFormValues>> {
  prefix: Prefix;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  showCompany?: boolean;
}

/** Pola adresu PL (imię/nazwisko, firma, ulica, nr, kod, miasto, telefon). */
export function AddressForm<T extends Record<Prefix, AddressFormValues>>({ prefix, register, errors, showCompany = true }: AddressFormProps<T>) {
  // react-hook-form wymaga ścieżek typu Path<T>; przy generycznym prefiksie rzutujemy przez unknown.
  const reg = register as unknown as UseFormRegister<Record<string, unknown>>;
  const err = (errors as unknown as Record<Prefix, Partial<Record<keyof AddressFormValues, { message?: string }>>>)[prefix] ?? {};
  const f = (name: keyof AddressFormValues) => `${prefix}.${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Imię i nazwisko" required error={err.full_name?.message} htmlFor={f("full_name")} className="sm:col-span-2">
        <Input id={f("full_name")} autoComplete="name" {...reg(f("full_name"))} />
      </FormField>
      {showCompany && (
        <FormField label="Firma (opcjonalnie)" error={err.company_name?.message} htmlFor={f("company_name")} className="sm:col-span-2">
          <Input id={f("company_name")} autoComplete="organization" {...reg(f("company_name"))} />
        </FormField>
      )}
      <FormField label="Ulica" required error={err.street?.message} htmlFor={f("street")} className="sm:col-span-2">
        <Input id={f("street")} autoComplete="address-line1" {...reg(f("street"))} />
      </FormField>
      <FormField label="Nr budynku" required error={err.building_no?.message} htmlFor={f("building_no")}>
        <Input id={f("building_no")} {...reg(f("building_no"))} />
      </FormField>
      <FormField label="Nr lokalu" error={err.apartment_no?.message} htmlFor={f("apartment_no")}>
        <Input id={f("apartment_no")} {...reg(f("apartment_no"))} />
      </FormField>
      <FormField label="Kod pocztowy" required error={err.postal_code?.message} htmlFor={f("postal_code")}>
        <Input id={f("postal_code")} placeholder="00-000" inputMode="numeric" autoComplete="postal-code" {...reg(f("postal_code"))} />
      </FormField>
      <FormField label="Miejscowość" required error={err.city?.message} htmlFor={f("city")}>
        <Input id={f("city")} autoComplete="address-level2" {...reg(f("city"))} />
      </FormField>
      <FormField label="Telefon do kuriera" error={err.phone?.message} htmlFor={f("phone")} className="sm:col-span-2">
        <Input id={f("phone")} type="tel" autoComplete="tel" {...reg(f("phone"))} />
      </FormField>
      <input type="hidden" value="PL" {...reg(f("country"))} />
    </div>
  );
}
