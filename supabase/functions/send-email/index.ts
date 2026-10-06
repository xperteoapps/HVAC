// send-email — renderuje szablon i wysyła przez Resend. Tylko service role lub admin/staff.
// POST { template, to?, payload }

import { z } from "zod";
import { errorToResponse, handleOptions, HttpError, jsonResponse, readJson } from "../_shared/cors.ts";
import { createAdminClient, getCaller, requireAdmin } from "../_shared/supabase.ts";
import {
  b2bApproved,
  type EmailOrder,
  type EmailOrderItem,
  orderConfirmationCustomer,
  orderNotificationAdmin,
  type RenderedEmail,
  syncFailedAdmin,
} from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const addressSchema = z.object({
  full_name: z.string().nullish(),
  company_name: z.string().nullish(),
  street: z.string().nullish(),
  building_no: z.string().nullish(),
  apartment_no: z.string().nullish(),
  postal_code: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  phone: z.string().nullish(),
  nip: z.string().nullish(),
}).passthrough();

const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  email: z.string().email(),
  status: z.string(),
  payment_status: z.string(),
  price_mode: z.enum(["gross", "net"]).default("gross"),
  customer_group_code: z.string().nullish(),
  subtotal_net_cents: z.number().int(),
  shipping_net_cents: z.number().int(),
  vat_cents: z.number().int(),
  total_gross_cents: z.number().int(),
  shipping_method: z.string().nullish(),
  shipping_method_name: z.string().nullish(),
  shipping_address: addressSchema.nullish(),
  billing_address: addressSchema.nullish(),
  invoice_requested: z.boolean().optional(),
  nip: z.string().nullish(),
  notes: z.string().nullish(),
  payment_due_date: z.string().nullish(),
  created_at: z.string(),
});

const itemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  qty: z.number().int().positive(),
  price_net_cents: z.number().int(),
  vat_rate: z.number(),
});

const bodySchema = z.discriminatedUnion("template", [
  z.object({
    template: z.literal("order_confirmation"),
    to: z.string().email().optional(),
    payload: z.object({
      order: orderSchema,
      items: z.array(itemSchema),
      payment_instructions: z.string().nullish(),
    }),
  }),
  z.object({
    template: z.literal("order_admin"),
    to: z.string().email().optional(),
    payload: z.object({ order: orderSchema, items: z.array(itemSchema) }),
  }),
  z.object({
    template: z.literal("sync_failed"),
    to: z.string().email().optional(),
    payload: z.object({ supplier_name: z.string(), error: z.string() }),
  }),
  z.object({
    template: z.literal("b2b_approved"),
    to: z.string().email(),
    payload: z.object({ name: z.string().nullish() }),
  }),
]);

type Body = z.infer<typeof bodySchema>;

function toEmailOrder(order: z.infer<typeof orderSchema>): EmailOrder {
  return {
    ...order,
    shipping_method: order.shipping_method ?? null,
    shipping_address: order.shipping_address ?? null,
    billing_address: order.billing_address ?? null,
  };
}

function render(body: Body): { to: string | null; email: RenderedEmail } {
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? null;
  switch (body.template) {
    case "order_confirmation": {
      const order = toEmailOrder(body.payload.order);
      const items: EmailOrderItem[] = body.payload.items;
      return {
        to: body.to ?? order.email,
        email: orderConfirmationCustomer(order, items, body.payload.payment_instructions),
      };
    }
    case "order_admin": {
      const order = toEmailOrder(body.payload.order);
      return { to: body.to ?? adminEmail, email: orderNotificationAdmin(order, body.payload.items) };
    }
    case "sync_failed":
      return {
        to: body.to ?? adminEmail,
        email: syncFailedAdmin(body.payload.supplier_name, body.payload.error),
      };
    case "b2b_approved":
      return { to: body.to, email: b2bApproved(body.payload.name) };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      throw new HttpError(405, "Dozwolona jest tylko metoda POST.");
    }

    const admin = createAdminClient();
    const caller = await getCaller(req, admin);
    requireAdmin(caller);

    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(
        400,
        `Nieprawidłowe dane: ${issue ? `${issue.path.join(".")} — ${issue.message}` : "błąd walidacji"}`,
        "VALIDATION",
      );
    }

    const { to, email } = render(parsed.data);
    if (!to) {
      throw new HttpError(400, "Brak adresata (podaj `to` albo ustaw ADMIN_EMAIL).", "NO_RECIPIENT");
    }

    const result = await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
    return jsonResponse({ template: parsed.data.template, to, subject: email.subject, result });
  } catch (err) {
    return errorToResponse(err, "send-email");
  }
});
