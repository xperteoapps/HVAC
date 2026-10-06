import { z } from "zod";

export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}-\d{3}$/, "Kod pocztowy w formacie 00-000");

export const phoneSchema = z
  .string()
  .trim()
  .min(9, "Podaj numer telefonu")
  .regex(/^[+\d\s-]{9,16}$/, "Nieprawidłowy numer telefonu");

export function isValidNip(value: string): boolean {
  const d = value.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(d)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  return sum % 11 === Number(d[9]);
}

export const nipSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidNip(v), "Nieprawidłowy NIP");

export const addressSchema = z.object({
  full_name: z.string().trim().min(3, "Podaj imię i nazwisko"),
  company_name: z.string().trim().optional().or(z.literal("")),
  street: z.string().trim().min(2, "Podaj ulicę"),
  building_no: z.string().trim().min(1, "Podaj numer budynku"),
  apartment_no: z.string().trim().optional().or(z.literal("")),
  postal_code: postalCodeSchema,
  city: z.string().trim().min(2, "Podaj miejscowość"),
  country: z.string().default("PL"),
  phone: phoneSchema.optional().or(z.literal("")),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

export const emailSchema = z.string().trim().email("Nieprawidłowy adres e-mail");
