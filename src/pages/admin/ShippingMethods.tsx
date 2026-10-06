import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { errorMessage } from "@/components/admin/helpers";
import { formatPrice } from "@/lib/formatters";
import type { Insert, ShippingMethod, Update } from "@/types";

interface MethodForm {
  code: string;
  name: string;
  carrier: string;
  description: string;
  price_net_cents: number | null;
  free_from_cents: number | null;
  free_from_cents_b2b: number | null;
  max_weight_kg: string;
  pallet: boolean;
  pickup: boolean;
  active: boolean;
  position: string;
}

function formFrom(m: ShippingMethod | null): MethodForm {
  return {
    code: m?.code ?? "",
    name: m?.name ?? "",
    carrier: m?.carrier ?? "",
    description: m?.description ?? "",
    price_net_cents: m?.price_net_cents ?? 0,
    free_from_cents: m?.free_from_cents ?? null,
    free_from_cents_b2b: m?.free_from_cents_b2b ?? null,
    max_weight_kg: m?.max_weight_kg !== null && m?.max_weight_kg !== undefined ? String(m.max_weight_kg) : "",
    pallet: m?.pallet ?? false,
    pickup: m?.pickup ?? false,
    active: m?.active ?? true,
    position: String(m?.position ?? 0),
  };
}

export function ShippingMethods() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ method: ShippingMethod | null; form: MethodForm } | null>(null);
  const [deleting, setDeleting] = useState<ShippingMethod | null>(null);

  const methods = useQuery({
    queryKey: ["admin-shipping-methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_methods").select("*").order("position").order("name");
      if (error) throw error;
      return (data ?? []) as ShippingMethod[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-shipping-methods"] });
    qc.invalidateQueries({ queryKey: ["shipping"] });
  };

  const save = useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: Insert<"shipping_methods"> }) => {
      if (id) {
        const { error } = await supabase.from("shipping_methods").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shipping_methods").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Zapisano metodę dostawy");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać metody dostawy")),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Update<"shipping_methods"> }) => {
      const { error } = await supabase.from("shipping_methods").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zapisano");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać zmian")),
  });

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from("shipping_methods").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success("Usunięto metodę dostawy");
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "Nie udało się usunąć metody dostawy"));
    }
  };

  const openEdit = (method: ShippingMethod | null) => setEditing({ method, form: formFrom(method) });
  const setForm = (p: Partial<MethodForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));

  const submit = () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.code.trim() || !f.name.trim()) {
      toast.error("Kod i nazwa są wymagane");
      return;
    }
    const position = Number(f.position);
    if (!Number.isInteger(position)) {
      toast.error("Pozycja musi być liczbą całkowitą");
      return;
    }
    const maxWeight = f.max_weight_kg.trim() ? Number(f.max_weight_kg.replace(",", ".")) : null;
    if (maxWeight !== null && (!Number.isFinite(maxWeight) || maxWeight <= 0)) {
      toast.error("Maksymalna waga musi być liczbą dodatnią");
      return;
    }
    save.mutate({
      id: editing.method?.id ?? null,
      values: {
        code: f.code.trim().toLowerCase().replace(/\s+/g, "_"),
        name: f.name.trim(),
        carrier: f.carrier.trim() || null,
        description: f.description.trim() || null,
        price_net_cents: f.price_net_cents ?? 0,
        free_from_cents: f.free_from_cents,
        free_from_cents_b2b: f.free_from_cents_b2b,
        max_weight_kg: maxWeight,
        pallet: f.pallet,
        pickup: f.pickup,
        active: f.active,
        position,
      },
    });
  };

  const rows = methods.data ?? [];

  return (
    <div>
      <Seo noindex title="Metody dostawy · Panel admina" />
      <PageHeader
        title="Metody dostawy"
        description="Kurier, paleta i odbiór osobisty. Ceny netto; progi darmowej dostawy osobno dla B2C i B2B."
        actions={
          <Button size="sm" onClick={() => openEdit(null)}>
            <Plus /> Nowa metoda
          </Button>
        }
      />
      {methods.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(methods.error)}</p>}
      {methods.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Brak metod dostawy" description="Bez metod dostawy klienci nie dokończą zamówienia." action={<Button onClick={() => openEdit(null)}>Dodaj metodę</Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Poz.</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Przewoźnik</TableHead>
                <TableHead className="text-right">Cena netto</TableHead>
                <TableHead className="text-right">Darmowa od (B2C)</TableHead>
                <TableHead className="text-right">Darmowa od (B2B)</TableHead>
                <TableHead className="text-right">Maks. waga</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Aktywna</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-right tabular-nums">{m.position}</TableCell>
                  <TableCell>
                    <p className="font-medium">{m.name}</p>
                    {m.description && <p className="max-w-[16rem] truncate text-xs text-muted-foreground">{m.description}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.code}</TableCell>
                  <TableCell className="text-sm">{m.carrier ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{formatPrice(m.price_net_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{m.free_from_cents !== null ? formatPrice(m.free_from_cents) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{m.free_from_cents_b2b !== null ? formatPrice(m.free_from_cents_b2b) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.max_weight_kg !== null ? `${m.max_weight_kg} kg` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {m.pallet && <Badge variant="secondary">paleta</Badge>}
                      {m.pickup && <Badge variant="outline">odbiór</Badge>}
                      {!m.pallet && !m.pickup && <Badge variant="outline">kurier</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={m.active} disabled={patch.isPending} onCheckedChange={(c) => patch.mutate({ id: m.id, values: { active: c } })} aria-label="Aktywna" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edytuj" onClick={() => openEdit(m)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Usuń" onClick={() => setDeleting(m)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing.method ? "Edycja metody dostawy" : "Nowa metoda dostawy"}</DialogTitle>
              <DialogDescription>Kod jest używany przez kalkulator dostawy i zapisywany w zamówieniach.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <FormField label="Nazwa" htmlFor="sm-name" required>
                <Input id="sm-name" value={editing.form.name} onChange={(e) => setForm({ name: e.target.value })} />
              </FormField>
              <FormField label="Kod" htmlFor="sm-code" required hint="np. kurier, paleta, odbior">
                <Input id="sm-code" value={editing.form.code} onChange={(e) => setForm({ code: e.target.value })} disabled={Boolean(editing.method)} />
              </FormField>
              <FormField label="Przewoźnik" htmlFor="sm-carrier">
                <Input id="sm-carrier" value={editing.form.carrier} onChange={(e) => setForm({ carrier: e.target.value })} placeholder="np. DPD, Raben" />
              </FormField>
              <FormField label="Pozycja" htmlFor="sm-position">
                <Input id="sm-position" inputMode="numeric" value={editing.form.position} onChange={(e) => setForm({ position: e.target.value })} />
              </FormField>
              <FormField label="Opis dla klienta" htmlFor="sm-desc" className="sm:col-span-2">
                <Textarea id="sm-desc" rows={2} value={editing.form.description} onChange={(e) => setForm({ description: e.target.value })} />
              </FormField>
              <FormField label="Cena netto" htmlFor="sm-price" required>
                <MoneyInput id="sm-price" valueCents={editing.form.price_net_cents} onChangeCents={(c) => setForm({ price_net_cents: c })} />
              </FormField>
              <FormField label="Maks. waga (kg)" htmlFor="sm-weight" hint="Puste = bez limitu">
                <Input id="sm-weight" inputMode="decimal" value={editing.form.max_weight_kg} onChange={(e) => setForm({ max_weight_kg: e.target.value })} />
              </FormField>
              <FormField label="Darmowa od (B2C, brutto)" htmlFor="sm-free" hint="Puste = nigdy">
                <MoneyInput id="sm-free" valueCents={editing.form.free_from_cents} onChangeCents={(c) => setForm({ free_from_cents: c })} />
              </FormField>
              <FormField label="Darmowa od (B2B, netto)" htmlFor="sm-free-b2b" hint="Puste = nigdy">
                <MoneyInput id="sm-free-b2b" valueCents={editing.form.free_from_cents_b2b} onChangeCents={(c) => setForm({ free_from_cents_b2b: c })} />
              </FormField>
              <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.form.pallet} onCheckedChange={(c) => setForm({ pallet: c === true })} /> Dostawa paletowa
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={editing.form.pickup} onCheckedChange={(c) => setForm({ pickup: c === true })} /> Odbiór osobisty
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.form.active} onCheckedChange={(c) => setForm({ active: c })} /> Aktywna
                </label>
              </div>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="animate-spin" />} Zapisz
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Usunąć metodę dostawy?"
        description={`Metoda „${deleting?.name ?? ""}” zniknie z checkoutu. Zamówienia historyczne zachowają jej kod.`}
        confirmLabel="Usuń"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
