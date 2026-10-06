import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SearchInput } from "@/components/admin/SearchInput";
import { MoneyInput } from "@/components/admin/MoneyInput";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { MARGIN_SCOPES, MARGIN_SCOPE_LABELS, categoryDepths, errorMessage, indentLabel } from "@/components/admin/helpers";
import { useBrands, useCategories } from "@/hooks/useCategories";
import { formatPrice, plural } from "@/lib/formatters";
import type { Insert, MarginRule } from "@/types";

interface Option {
  id: string;
  label: string;
}

interface ProductLite {
  id: string;
  sku: string;
  name: string;
}

interface PreviewRow {
  product_id: string;
  sku: string;
  name: string;
  purchase_net_cents: number;
  current_price_net_cents: number;
  new_price_net_cents: number;
}

interface RuleForm {
  name: string;
  scope: string;
  scope_id: string | null;
  margin_pct: string;
  min_margin_cents: number | null;
  priority: string;
  active: boolean;
}

function emptyForm(): RuleForm {
  return { name: "", scope: "global", scope_id: null, margin_pct: "20", min_margin_cents: 0, priority: "0", active: true };
}

function formFromRule(r: MarginRule): RuleForm {
  return {
    name: r.name ?? "",
    scope: r.scope,
    scope_id: r.scope_id,
    margin_pct: String(r.margin_pct),
    min_margin_cents: r.min_margin_cents,
    priority: String(r.priority),
    active: r.active,
  };
}

function validate(form: RuleForm): { ok: true; values: Insert<"margin_rules"> } | { ok: false; error: string } {
  const margin = Number(form.margin_pct.replace(",", "."));
  if (!Number.isFinite(margin) || margin < -100) return { ok: false, error: "Marża musi być liczbą (procent)" };
  const priority = Number(form.priority);
  if (!Number.isInteger(priority)) return { ok: false, error: "Priorytet musi być liczbą całkowitą" };
  if (form.scope !== "global" && !form.scope_id) return { ok: false, error: "Wybierz cel reguły dla tego zakresu" };
  return {
    ok: true,
    values: {
      name: form.name.trim() || null,
      scope: form.scope,
      scope_id: form.scope === "global" ? null : form.scope_id,
      margin_pct: margin,
      min_margin_cents: form.min_margin_cents ?? 0,
      priority,
      active: form.active,
    },
  };
}

function ProductPicker({ value, onChange }: { value: ProductLite | null; onChange: (p: ProductLite | null) => void }) {
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["admin-search-products", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_products", { p_query: q.trim(), lim: 10, off: 0 });
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, sku: r.sku, name: r.name })) as ProductLite[];
    },
  });
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <span className="font-mono text-xs text-muted-foreground">{value.sku}</span> {value.name}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Zmień
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <SearchInput value={q} onChange={setQ} placeholder="Szukaj produktu (nazwa, SKU)…" />
      {q.trim().length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {results.isLoading ? (
            <Skeleton className="m-2 h-8" />
          ) : (results.data ?? []).length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Brak wyników.</p>
          ) : (
            <ul className="divide-y">
              {(results.data ?? []).map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-muted/60" onClick={() => onChange(p)}>
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function MarginRules() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string | null; form: RuleForm } | null>(null);
  const [deleting, setDeleting] = useState<MarginRule | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pickedProduct, setPickedProduct] = useState<ProductLite | null>(null);

  const rules = useQuery({
    queryKey: ["admin-margin-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("margin_rules").select("*").order("priority", { ascending: false }).order("created_at");
      if (error) throw error;
      return (data ?? []) as MarginRule[];
    },
  });

  const categoriesQ = useCategories();
  const brandsQ = useBrands();
  const suppliersQ = useQuery({
    queryKey: ["admin-suppliers-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name").order("priority");
      if (error) throw error;
      return data ?? [];
    },
  });

  const productIds = useMemo(() => (rules.data ?? []).filter((r) => r.scope === "product" && r.scope_id).map((r) => r.scope_id as string), [rules.data]);
  const productsQ = useQuery({
    queryKey: ["admin-margin-rule-products", productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, sku, name").in("id", productIds);
      if (error) throw error;
      return (data ?? []) as ProductLite[];
    },
  });

  const categoryOptions = useMemo<Option[]>(() => {
    const flat = categoriesQ.data?.flat ?? [];
    const depths = categoryDepths(flat);
    return flat.map((c) => ({ id: c.id, label: indentLabel(c.name, depths.get(c.id) ?? 0) }));
  }, [categoriesQ.data]);
  const brandOptions = useMemo<Option[]>(() => (brandsQ.data ?? []).map((b) => ({ id: b.id, label: b.name })), [brandsQ.data]);
  const supplierOptions = useMemo<Option[]>(() => (suppliersQ.data ?? []).map((s) => ({ id: s.id, label: s.name })), [suppliersQ.data]);

  const scopeTargetLabel = (r: MarginRule): string => {
    if (r.scope === "global" || !r.scope_id) return "wszystkie produkty";
    const find = (opts: Option[]) => opts.find((o) => o.id === r.scope_id)?.label.replace(/^(— )+/, "");
    switch (r.scope) {
      case "category":
        return find(categoryOptions) ?? r.scope_id;
      case "brand":
        return find(brandOptions) ?? r.scope_id;
      case "supplier":
        return find(supplierOptions) ?? r.scope_id;
      case "product": {
        const p = (productsQ.data ?? []).find((x) => x.id === r.scope_id);
        return p ? `${p.sku} · ${p.name}` : r.scope_id;
      }
      default:
        return r.scope_id;
    }
  };

  const recalcAll = async () => {
    const { data, error } = await supabase.rpc("recalc_all_products");
    if (error) throw error;
    return Number(data ?? 0);
  };

  const save = useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: Insert<"margin_rules"> }) => {
      if (id) {
        const { error } = await supabase.from("margin_rules").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("margin_rules").insert(values);
        if (error) throw error;
      }
      return recalcAll();
    },
    onSuccess: (count) => {
      toast.success(`Zapisano regułę. Przeliczono ${plural(count, "produkt", "produkty", "produktów")}.`);
      setEditing(null);
      setPreview(null);
      setPickedProduct(null);
      qc.invalidateQueries({ queryKey: ["admin-margin-rules"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać reguły")),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("margin_rules").update({ active }).eq("id", id);
      if (error) throw error;
      return recalcAll();
    },
    onSuccess: (count) => {
      toast.success(`Zmieniono aktywność. Przeliczono ${plural(count, "produkt", "produkty", "produktów")}.`);
      qc.invalidateQueries({ queryKey: ["admin-margin-rules"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zmienić reguły")),
  });

  const remove = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase.from("margin_rules").delete().eq("id", deleting.id);
      if (error) throw error;
      const count = await recalcAll();
      toast.success(`Usunięto regułę. Przeliczono ${plural(count, "produkt", "produkty", "produktów")}.`);
      qc.invalidateQueries({ queryKey: ["admin-margin-rules"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      toast.error(errorMessage(e, "Nie udało się usunąć reguły"));
    }
  };

  const runPreview = async () => {
    if (!editing) return;
    const v = validate(editing.form);
    if (!v.ok) {
      toast.error(v.error);
      return;
    }
    setPreviewing(true);
    try {
      const args = {
        p_scope: v.values.scope,
        p_scope_id: v.values.scope_id ?? null,
        p_margin_pct: v.values.margin_pct ?? 0,
        p_min_margin_cents: v.values.min_margin_cents ?? 0,
      };
      const { data, error } = await supabase.rpc("preview_margin_rule", args as unknown as { p_scope: string; p_scope_id: string; p_margin_pct: number; p_min_margin_cents: number });
      if (error) throw error;
      setPreview(((data ?? []) as PreviewRow[]).slice(0, 10));
    } catch (e) {
      toast.error(errorMessage(e, "Podgląd nie powiódł się"));
    } finally {
      setPreviewing(false);
    }
  };

  const openEdit = (rule: MarginRule | null) => {
    setPreview(null);
    if (rule) {
      setEditing({ id: rule.id, form: formFromRule(rule) });
      const p = rule.scope === "product" ? (productsQ.data ?? []).find((x) => x.id === rule.scope_id) ?? null : null;
      setPickedProduct(p);
    } else {
      setEditing({ id: null, form: emptyForm() });
      setPickedProduct(null);
    }
  };

  const setForm = (patch: Partial<RuleForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  const form = editing?.form;
  const targetOptions = form?.scope === "category" ? categoryOptions : form?.scope === "brand" ? brandOptions : form?.scope === "supplier" ? supplierOptions : [];

  return (
    <div>
      <Seo noindex title="Reguły marż · Panel admina" />
      <PageHeader
        title="Reguły marż"
        description="Marża narzucana na cenę zakupu z hurtowni. Wyższy priorytet wygrywa; reguła produktu ma pierwszeństwo przed kategorią, marką i hurtownią."
        actions={
          <Button size="sm" onClick={() => openEdit(null)}>
            <Plus /> Nowa reguła
          </Button>
        }
      />

      {rules.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(rules.error)}</p>}

      {rules.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (rules.data ?? []).length === 0 ? (
        <EmptyState
          title="Brak reguł marż"
          description="Bez reguł ceny sprzedaży nie zostaną wyliczone z cen zakupu. Dodaj przynajmniej regułę globalną."
          action={
            <Button onClick={() => openEdit(null)}>
              <Plus /> Dodaj regułę globalną
            </Button>
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>Zakres</TableHead>
                <TableHead>Cel</TableHead>
                <TableHead className="text-right">Marża</TableHead>
                <TableHead className="text-right">Min. marża</TableHead>
                <TableHead className="text-right">Priorytet</TableHead>
                <TableHead>Aktywna</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rules.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name || <span className="text-muted-foreground">(bez nazwy)</span>}</TableCell>
                  <TableCell>
                    <Badge variant={r.scope === "global" ? "default" : "secondary"}>{MARGIN_SCOPE_LABELS[r.scope] ?? r.scope}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate text-sm">{scopeTargetLabel(r)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.margin_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{formatPrice(r.min_margin_cents)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.priority}</TableCell>
                  <TableCell>
                    <Switch checked={r.active} disabled={toggleActive.isPending} onCheckedChange={(c) => toggleActive.mutate({ id: r.id, active: c })} aria-label="Aktywna" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edytuj" onClick={() => openEdit(r)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Usuń" onClick={() => setDeleting(r)}>
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

      {editing && form && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edycja reguły" : "Nowa reguła marży"}</DialogTitle>
              <DialogDescription>Po zapisaniu ceny wszystkich produktów zostaną przeliczone.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = validate(form);
                if (!v.ok) {
                  toast.error(v.error);
                  return;
                }
                save.mutate({ id: editing.id, values: v.values });
              }}
            >
              <FormField label="Nazwa" htmlFor="r-name" className="sm:col-span-2">
                <Input id="r-name" value={form.name} onChange={(e) => setForm({ name: e.target.value })} placeholder="np. Klimatyzatory KAISAI +18%" />
              </FormField>
              <FormField label="Zakres" htmlFor="r-scope">
                <Select
                  value={form.scope}
                  onValueChange={(v) => {
                    setForm({ scope: v, scope_id: null });
                    setPickedProduct(null);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger id="r-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARGIN_SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MARGIN_SCOPE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {form.scope === "global" ? (
                <div className="self-end pb-2 text-sm text-muted-foreground">Dotyczy wszystkich produktów bez bardziej szczegółowej reguły.</div>
              ) : form.scope === "product" ? (
                <FormField label="Produkt" required>
                  <ProductPicker
                    value={pickedProduct}
                    onChange={(p) => {
                      setPickedProduct(p);
                      setForm({ scope_id: p?.id ?? null });
                    }}
                  />
                </FormField>
              ) : (
                <FormField label={MARGIN_SCOPE_LABELS[form.scope]} htmlFor="r-target" required>
                  <Select value={form.scope_id ?? ""} onValueChange={(v) => setForm({ scope_id: v })}>
                    <SelectTrigger id="r-target">
                      <SelectValue placeholder="Wybierz…" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              <FormField label="Marża (%)" htmlFor="r-margin" required hint="Narzut na cenę zakupu netto">
                <Input id="r-margin" inputMode="decimal" value={form.margin_pct} onChange={(e) => setForm({ margin_pct: e.target.value })} />
              </FormField>
              <FormField label="Minimalna marża kwotowa" htmlFor="r-min" hint="Gdy procent daje mniej, zastosowana zostanie ta kwota">
                <MoneyInput id="r-min" valueCents={form.min_margin_cents} onChangeCents={(c) => setForm({ min_margin_cents: c })} />
              </FormField>
              <FormField label="Priorytet" htmlFor="r-priority" hint="Wyższy wygrywa w tym samym zakresie">
                <Input id="r-priority" inputMode="numeric" value={form.priority} onChange={(e) => setForm({ priority: e.target.value })} />
              </FormField>
              <div className="flex items-center gap-3 self-end pb-2">
                <Switch id="r-active" checked={form.active} onCheckedChange={(c) => setForm({ active: c })} />
                <label htmlFor="r-active" className="text-sm">
                  Reguła aktywna
                </label>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Podgląd zmian (10 produktów)</h3>
                  <Button type="button" variant="outline" size="sm" onClick={runPreview} disabled={previewing}>
                    {previewing ? <Loader2 className="animate-spin" /> : <Eye />} Podgląd
                  </Button>
                </div>
                {preview === null ? (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Kliknij „Podgląd”, aby zobaczyć, jak reguła zmieni ceny przykładowych produktów.</p>
                ) : preview.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Reguła nie obejmuje żadnych produktów z ceną zakupu.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Nazwa</TableHead>
                          <TableHead className="text-right">Zakup</TableHead>
                          <TableHead className="text-right">Obecna</TableHead>
                          <TableHead className="text-right">Nowa</TableHead>
                          <TableHead className="text-right">Zmiana</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row) => {
                          const delta = row.current_price_net_cents > 0 ? ((row.new_price_net_cents - row.current_price_net_cents) / row.current_price_net_cents) * 100 : null;
                          return (
                            <TableRow key={row.product_id}>
                              <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                              <TableCell className="max-w-[14rem] truncate text-xs">{row.name}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">{formatPrice(row.purchase_net_cents)}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">{formatPrice(row.current_price_net_cents)}</TableCell>
                              <TableCell className="text-right text-xs font-semibold tabular-nums whitespace-nowrap">{formatPrice(row.new_price_net_cents)}</TableCell>
                              <TableCell className={`text-right text-xs tabular-nums ${delta === null ? "" : delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : ""}`}>
                                {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
                  Anuluj
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="animate-spin" />} Zapisz i przelicz ceny
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Usunąć regułę?"
        description={`Reguła „${deleting?.name || MARGIN_SCOPE_LABELS[deleting?.scope ?? ""] || ""}” zostanie usunięta, a ceny produktów przeliczone.`}
        confirmLabel="Usuń"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
