import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Star, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { AddressForm } from "@/components/checkout/AddressForm";
import { useAuth } from "@/hooks/useAuth";
import { useMyAddresses } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { addressSchema, type AddressFormValues } from "@/lib/validators";
import type { Address } from "@/types";

const schema = z.object({ shipping: addressSchema, billing: addressSchema });
type Values = z.infer<typeof schema>;

const empty: AddressFormValues = { full_name: "", company_name: "", street: "", building_no: "", apartment_no: "", postal_code: "", city: "", country: "PL", phone: "" };

export default function Addresses() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: addresses, isLoading } = useMyAddresses(user?.id);
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { shipping: empty, billing: empty } });

  const open = (a: Address | "new") => {
    setEditing(a);
    form.reset({
      shipping: a === "new" ? { ...empty, full_name: "" } : { full_name: a.full_name, company_name: a.company_name ?? "", street: a.street, building_no: a.building_no, apartment_no: a.apartment_no ?? "", postal_code: a.postal_code, city: a.city, country: a.country, phone: a.phone ?? "" },
      billing: empty,
    });
  };

  const save = async (v: Values) => {
    if (!user) return;
    const payload = { ...v.shipping, company_name: v.shipping.company_name || null, apartment_no: v.shipping.apartment_no || null, phone: v.shipping.phone || null, profile_id: user.id, type: "shipping" as const };
    const { error } = editing === "new" || !editing ? await supabase.from("addresses").insert({ ...payload, is_default: (addresses?.length ?? 0) === 0 }) : await supabase.from("addresses").update(payload).eq("id", editing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Adres zapisany");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["addresses", user.id] });
  };

  const setDefault = async (a: Address) => {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id);
    const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", a.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["addresses", user.id] });
  };

  const remove = async (a: Address) => {
    if (!user || !confirm("Usunąć ten adres?")) return;
    const { error } = await supabase.from("addresses").delete().eq("id", a.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["addresses", user.id] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Adresy dostawy</h2>
        <Button size="sm" onClick={() => open("new")}>
          <Plus className="h-4 w-4" /> Dodaj adres
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : !addresses || addresses.length === 0 ? (
        <EmptyState title="Brak zapisanych adresów" description="Dodaj adres, aby szybciej składać zamówienia." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-4 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{a.full_name}</span>
                {a.is_default && <Badge variant="accent">Domyślny</Badge>}
              </div>
              {a.company_name && <div>{a.company_name}</div>}
              <div>
                {a.street} {a.building_no}
                {a.apartment_no ? `/${a.apartment_no}` : ""}
              </div>
              <div>
                {a.postal_code} {a.city}
              </div>
              {a.phone && <div className="text-muted-foreground">tel. {a.phone}</div>}
              <div className="mt-3 flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => open(a)}>
                  <Pencil className="h-3.5 w-3.5" /> Edytuj
                </Button>
                {!a.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => setDefault(a)}>
                    <Star className="h-3.5 w-3.5" /> Domyślny
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(a)}>
                  <Trash2 className="h-3.5 w-3.5" /> Usuń
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nowy adres" : "Edytuj adres"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(save)} className="space-y-4" noValidate>
            <AddressForm prefix="shipping" register={form.register} errors={form.formState.errors} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Zapisz
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
