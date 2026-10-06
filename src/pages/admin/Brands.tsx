import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { errorMessage, slugify } from "@/components/admin/helpers";
import { useBrands } from "@/hooks/useCategories";
import type { Brand, Insert } from "@/types";

interface BrandForm {
  name: string;
  slug: string;
  logo_url: string;
}

export function Brands() {
  const qc = useQueryClient();
  const brands = useBrands();
  const [editing, setEditing] = useState<{ brand: Brand | null; form: BrandForm } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleting, setDeleting] = useState<Brand | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["brands"] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const save = useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: Insert<"brands"> }) => {
      if (id) {
        const { error } = await supabase.from("brands").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brands").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Zapisano markę");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać marki")),
  });

  const remove = async () => {
    if (!deleting) return;
    try {
      const { count, error: cErr } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("brand_id", deleting.id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        toast.error(`Marka jest przypisana do ${count} produktów — najpierw zmień markę tych produktów.`);
        return;
      }
      const { error } = await supabase.from("brands").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success("Usunięto markę");
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "Nie udało się usunąć marki"));
    }
  };

  const openEdit = (brand: Brand | null) => {
    setEditing({ brand, form: { name: brand?.name ?? "", slug: brand?.slug ?? "", logo_url: brand?.logo_url ?? "" } });
    setSlugTouched(Boolean(brand));
  };
  const setForm = (patch: Partial<BrandForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  const submit = () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.name.trim() || !f.slug.trim()) {
      toast.error("Nazwa i slug są wymagane");
      return;
    }
    save.mutate({ id: editing.brand?.id ?? null, values: { name: f.name.trim(), slug: f.slug.trim(), logo_url: f.logo_url.trim() || null } });
  };

  const rows = brands.data ?? [];

  return (
    <div>
      <Seo noindex title="Marki · Panel admina" />
      <PageHeader
        title="Marki"
        description="Producenci widoczni w filtrach i na kartach produktów."
        actions={
          <Button size="sm" onClick={() => openEdit(null)}>
            <Plus /> Nowa marka
          </Button>
        }
      />
      {brands.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(brands.error)}</p>}
      {brands.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Brak marek" action={<Button onClick={() => openEdit(null)}>Dodaj pierwszą markę</Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Logo</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    {b.logo_url ? (
                      <img src={b.logo_url} alt={b.name} className="h-8 w-12 rounded border object-contain" loading="lazy" />
                    ) : (
                      <span className="flex h-8 w-12 items-center justify-center rounded border bg-secondary text-xs font-semibold text-muted-foreground">{b.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.slug}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edytuj" onClick={() => openEdit(b)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Usuń" onClick={() => setDeleting(b)}>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.brand ? "Edycja marki" : "Nowa marka"}</DialogTitle>
              <DialogDescription>Slug jest używany w adresach URL filtrów.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <FormField label="Nazwa" htmlFor="brand-name" required>
                <Input
                  id="brand-name"
                  value={editing.form.name}
                  onChange={(e) => {
                    setForm({ name: e.target.value });
                    if (!slugTouched) setForm({ slug: slugify(e.target.value) });
                  }}
                />
              </FormField>
              <FormField label="Slug" htmlFor="brand-slug" required>
                <Input
                  id="brand-slug"
                  value={editing.form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm({ slug: e.target.value });
                  }}
                  onBlur={(e) => setForm({ slug: slugify(e.target.value) || e.target.value })}
                />
              </FormField>
              <FormField label="Adres logo" htmlFor="brand-logo">
                <Input id="brand-logo" value={editing.form.logo_url} onChange={(e) => setForm({ logo_url: e.target.value })} placeholder="https://…" />
              </FormField>
              <DialogFooter>
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
        title="Usunąć markę?"
        description={`Marka „${deleting?.name ?? ""}” zostanie trwale usunięta. Usunięcie jest możliwe tylko, gdy żaden produkt jej nie używa.`}
        confirmLabel="Usuń"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
