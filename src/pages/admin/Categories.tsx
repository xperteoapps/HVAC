import { useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { NONE_VALUE, errorMessage, indentLabel, slugify } from "@/components/admin/helpers";
import { useCategories } from "@/hooks/useCategories";
import type { Category, CategoryNode, Insert } from "@/types";

interface FlatNode {
  node: CategoryNode;
  depth: number;
}

function flattenWithDepth(tree: CategoryNode[], depth = 0): FlatNode[] {
  return tree.flatMap((n) => [{ node: n, depth }, ...flattenWithDepth(n.children, depth + 1)]);
}

interface CategoryForm {
  name: string;
  slug: string;
  parent_id: string;
  position: string;
  image_url: string;
  description: string;
  seo_title: string;
  seo_description: string;
}

function formFrom(c: Category | null, parentId?: string | null): CategoryForm {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    parent_id: c?.parent_id ?? parentId ?? NONE_VALUE,
    position: String(c?.position ?? 0),
    image_url: c?.image_url ?? "",
    description: c?.description ?? "",
    seo_title: c?.seo_title ?? "",
    seo_description: c?.seo_description ?? "",
  };
}

/** Zbiera id węzła i wszystkich potomków (nie można ustawić rodzica na samego siebie). */
function descendantIds(node: CategoryNode): Set<string> {
  const ids = new Set<string>([node.id]);
  const walk = (n: CategoryNode) => n.children.forEach((c) => (ids.add(c.id), walk(c)));
  walk(node);
  return ids;
}

export function Categories() {
  const qc = useQueryClient();
  const categories = useCategories();
  const [editing, setEditing] = useState<{ category: Category | null; form: CategoryForm } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleting, setDeleting] = useState<FlatNode | null>(null);

  const flat = useMemo(() => flattenWithDepth(categories.data?.tree ?? []), [categories.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const save = useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: Insert<"categories"> }) => {
      if (id) {
        const { error } = await supabase.from("categories").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Zapisano kategorię");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać kategorii")),
  });

  const productCount = useQuery({
    queryKey: ["admin-category-product-count", deleting?.node.id],
    enabled: Boolean(deleting),
    queryFn: async () => {
      const { count, error } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", deleting!.node.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", deleting.node.id);
      if (error) throw error;
      toast.success("Usunięto kategorię");
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "Nie udało się usunąć kategorii"));
    }
  };

  const openEdit = (category: Category | null, parentId?: string | null) => {
    setEditing({ category, form: formFrom(category, parentId) });
    setSlugTouched(Boolean(category));
  };
  const setForm = (patch: Partial<CategoryForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  const submit = () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.name.trim() || !f.slug.trim()) {
      toast.error("Nazwa i slug są wymagane");
      return;
    }
    const position = Number(f.position);
    if (!Number.isInteger(position)) {
      toast.error("Pozycja musi być liczbą całkowitą");
      return;
    }
    save.mutate({
      id: editing.category?.id ?? null,
      values: {
        name: f.name.trim(),
        slug: f.slug.trim(),
        parent_id: f.parent_id === NONE_VALUE ? null : f.parent_id,
        position,
        image_url: f.image_url.trim() || null,
        description: f.description.trim() || null,
        seo_title: f.seo_title.trim() || null,
        seo_description: f.seo_description.trim() || null,
      },
    });
  };

  const excluded = useMemo(() => {
    if (!editing?.category) return new Set<string>();
    const node = flat.find((f) => f.node.id === editing.category!.id)?.node;
    return node ? descendantIds(node) : new Set<string>([editing.category.id]);
  }, [editing, flat]);

  const deleteBlocked = deleting ? deleting.node.children.length > 0 || (productCount.data ?? deleting.node.product_count) > 0 : false;

  return (
    <div>
      <Seo noindex title="Kategorie · Panel admina" />
      <PageHeader
        title="Kategorie"
        description="Drzewo kategorii sklepu (do 3 poziomów). Kategorii z podkategoriami lub produktami nie można usunąć."
        actions={
          <Button size="sm" onClick={() => openEdit(null)}>
            <Plus /> Nowa kategoria
          </Button>
        }
      />

      {categories.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(categories.error)}</p>}

      {categories.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : flat.length === 0 ? (
        <EmptyState title="Brak kategorii" action={<Button onClick={() => openEdit(null)}>Dodaj pierwszą kategorię</Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Pozycja</TableHead>
                <TableHead className="text-right">Produkty</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flat.map(({ node, depth }) => (
                <TableRow key={node.id}>
                  <TableCell>
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 1.25}rem` }}>
                      {node.image_url ? <img src={node.image_url} alt="" className="h-7 w-7 rounded border object-cover" /> : <span className="h-7 w-7 rounded border bg-secondary" />}
                      <span className={depth === 0 ? "font-semibold" : "font-medium"}>{node.name}</span>
                      {node.children.length > 0 && (
                        <Badge variant="outline" className="font-normal">
                          {node.children.length} podkat.
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{node.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{node.position}</TableCell>
                  <TableCell className="text-right tabular-nums">{node.product_count}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {depth < 2 && (
                        <Button variant="ghost" size="icon" aria-label="Dodaj podkategorię" title="Dodaj podkategorię" onClick={() => openEdit(null, node.id)}>
                          <Plus />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Edytuj" title="Edytuj" onClick={() => openEdit(node)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Usuń" title="Usuń" onClick={() => setDeleting({ node, depth })}>
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
              <DialogTitle>{editing.category ? "Edycja kategorii" : "Nowa kategoria"}</DialogTitle>
              <DialogDescription>Slug jest częścią adresu URL i powinien być unikalny.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <FormField label="Nazwa" htmlFor="cat-name" required>
                <Input
                  id="cat-name"
                  value={editing.form.name}
                  onChange={(e) => {
                    setForm({ name: e.target.value });
                    if (!slugTouched) setForm({ slug: slugify(e.target.value) });
                  }}
                />
              </FormField>
              <FormField label="Slug" htmlFor="cat-slug" required>
                <Input
                  id="cat-slug"
                  value={editing.form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm({ slug: e.target.value });
                  }}
                  onBlur={(e) => setForm({ slug: slugify(e.target.value) || e.target.value })}
                />
              </FormField>
              <FormField label="Kategoria nadrzędna" htmlFor="cat-parent">
                <Select value={editing.form.parent_id} onValueChange={(v) => setForm({ parent_id: v })}>
                  <SelectTrigger id="cat-parent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— główna —</SelectItem>
                    {flat
                      .filter((f) => !excluded.has(f.node.id) && f.depth < 2)
                      .map((f) => (
                        <SelectItem key={f.node.id} value={f.node.id}>
                          {indentLabel(f.node.name, f.depth)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Pozycja" htmlFor="cat-position">
                <Input id="cat-position" inputMode="numeric" value={editing.form.position} onChange={(e) => setForm({ position: e.target.value })} />
              </FormField>
              <FormField label="Adres obrazka" htmlFor="cat-image" className="sm:col-span-2">
                <Input id="cat-image" value={editing.form.image_url} onChange={(e) => setForm({ image_url: e.target.value })} placeholder="https://…" />
              </FormField>
              <FormField label="Opis" htmlFor="cat-desc" className="sm:col-span-2">
                <Textarea id="cat-desc" rows={3} value={editing.form.description} onChange={(e) => setForm({ description: e.target.value })} />
              </FormField>
              <FormField label="Tytuł SEO" htmlFor="cat-seo-title">
                <Input id="cat-seo-title" value={editing.form.seo_title} onChange={(e) => setForm({ seo_title: e.target.value })} />
              </FormField>
              <FormField label="Opis SEO" htmlFor="cat-seo-desc">
                <Input id="cat-seo-desc" value={editing.form.seo_description} onChange={(e) => setForm({ seo_description: e.target.value })} />
              </FormField>
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

      {deleting && deleteBlocked ? (
        <Dialog open onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nie można usunąć kategorii</DialogTitle>
              <DialogDescription>
                Kategoria „{deleting.node.name}” ma {deleting.node.children.length > 0 ? `${deleting.node.children.length} podkategorii` : ""}
                {deleting.node.children.length > 0 && (productCount.data ?? deleting.node.product_count) > 0 ? " i " : ""}
                {(productCount.data ?? deleting.node.product_count) > 0 ? `${productCount.data ?? deleting.node.product_count} produktów` : ""}. Najpierw przenieś je do innej
                kategorii.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Zamknij
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <ConfirmDialog
          open={Boolean(deleting) && !productCount.isLoading}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Usunąć kategorię?"
          description={`Kategoria „${deleting?.node.name ?? ""}” zostanie trwale usunięta.`}
          confirmLabel="Usuń"
          destructive
          onConfirm={remove}
        />
      )}
    </div>
  );
}
