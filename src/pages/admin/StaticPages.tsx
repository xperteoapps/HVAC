import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bold, ExternalLink, Heading2, Link as LinkIcon, List, Loader2, Pencil, Pilcrow, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
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
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { errorMessage, slugify } from "@/components/admin/helpers";
import { formatDate } from "@/lib/formatters";
import type { Insert, StaticPage, Update } from "@/types";

interface PageForm {
  title: string;
  slug: string;
  content_html: string;
  published: boolean;
  position: string;
  seo_title: string;
  seo_description: string;
}

function formFrom(p: StaticPage | null): PageForm {
  return {
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    content_html: p?.content_html ?? "",
    published: p?.published ?? false,
    position: String(p?.position ?? 0),
    seo_title: p?.seo_title ?? "",
    seo_description: p?.seo_description ?? "",
  };
}

interface ToolbarAction {
  label: string;
  icon: typeof Bold;
  before: string;
  after: string;
  placeholder: string;
  block?: boolean;
}

const TOOLBAR: ToolbarAction[] = [
  { label: "Nagłówek", icon: Heading2, before: "<h2>", after: "</h2>", placeholder: "Nagłówek sekcji", block: true },
  { label: "Akapit", icon: Pilcrow, before: "<p>", after: "</p>", placeholder: "Treść akapitu", block: true },
  { label: "Lista", icon: List, before: "<ul>\n  <li>", after: "</li>\n</ul>", placeholder: "Pozycja listy", block: true },
  { label: "Pogrubienie", icon: Bold, before: "<strong>", after: "</strong>", placeholder: "tekst" },
  { label: "Link", icon: LinkIcon, before: '<a href="https://">', after: "</a>", placeholder: "tekst linku" },
];

function HtmlEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (action: ToolbarAction) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || action.placeholder;
    const needsNewline = action.block && start > 0 && value[start - 1] !== "\n";
    const snippet = `${needsNewline ? "\n" : ""}${action.before}${selected}${action.after}${action.block ? "\n" : ""}`;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const selStart = start + (needsNewline ? 1 : 0) + action.before.length;
      el.setSelectionRange(selStart, selStart + selected.length);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Wstaw element HTML">
        {TOOLBAR.map((a) => (
          <Button key={a.label} type="button" variant="outline" size="sm" className="h-8 px-2" title={a.label} onClick={() => insert(a)}>
            <a.icon /> <span className="text-xs">{a.label}</span>
          </Button>
        ))}
      </div>
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={18} className="font-mono text-xs" spellCheck={false} />
    </div>
  );
}

export function StaticPages() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ page: StaticPage | null; form: PageForm } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleting, setDeleting] = useState<StaticPage | null>(null);

  const pages = useQuery({
    queryKey: ["admin-static-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("static_pages").select("*").order("position").order("title");
      if (error) throw error;
      return (data ?? []) as StaticPage[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-static-pages"] });
    qc.invalidateQueries({ queryKey: ["static_page"] });
    qc.invalidateQueries({ queryKey: ["static_pages"] });
  };

  const save = useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: Insert<"static_pages"> }) => {
      if (id) {
        const { error } = await supabase.from("static_pages").update(values).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("static_pages").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Zapisano stronę");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać strony")),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Update<"static_pages"> }) => {
      const { error } = await supabase.from("static_pages").update(values).eq("id", id);
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
      const { error } = await supabase.from("static_pages").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success("Usunięto stronę");
      invalidate();
    } catch (e) {
      toast.error(errorMessage(e, "Nie udało się usunąć strony"));
    }
  };

  const openEdit = (page: StaticPage | null) => {
    setEditing({ page, form: formFrom(page) });
    setSlugTouched(Boolean(page));
  };
  const setForm = (p: Partial<PageForm>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...p } } : e));

  const submit = () => {
    if (!editing) return;
    const f = editing.form;
    if (!f.title.trim() || !f.slug.trim()) {
      toast.error("Tytuł i slug są wymagane");
      return;
    }
    const position = Number(f.position);
    if (!Number.isInteger(position)) {
      toast.error("Pozycja musi być liczbą całkowitą");
      return;
    }
    save.mutate({
      id: editing.page?.id ?? null,
      values: {
        title: f.title.trim(),
        slug: f.slug.trim(),
        content_html: f.content_html,
        published: f.published,
        position,
        seo_title: f.seo_title.trim() || null,
        seo_description: f.seo_description.trim() || null,
      },
    });
  };

  const rows = pages.data ?? [];

  return (
    <div>
      <Seo noindex title="Strony · Panel admina" />
      <PageHeader
        title="Strony statyczne"
        description="Regulamin, polityka prywatności, dostawa i płatność, kontakt, o nas. Prosty edytor HTML z podglądem."
        actions={
          <Button size="sm" onClick={() => openEdit(null)}>
            <Plus /> Nowa strona
          </Button>
        }
      />
      {pages.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(pages.error)}</p>}
      {pages.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Brak stron" action={<Button onClick={() => openEdit(null)}>Dodaj pierwszą stronę</Button>} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">Poz.</TableHead>
                <TableHead>Tytuł</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Zmieniono</TableHead>
                <TableHead>Opublikowana</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-right tabular-nums">{p.position}</TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">/strona/{p.slug}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(p.updated_at, true)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.published} disabled={patch.isPending} onCheckedChange={(c) => patch.mutate({ id: p.id, values: { published: c } })} aria-label="Opublikowana" />
                      {!p.published && <Badge variant="outline">szkic</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {p.published && (
                        <Button asChild variant="ghost" size="icon" aria-label="Otwórz w sklepie">
                          <Link to={`/strona/${p.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink />
                          </Link>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Edytuj" onClick={() => openEdit(p)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Usuń" onClick={() => setDeleting(p)}>
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
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>{editing.page ? "Edycja strony" : "Nowa strona"}</DialogTitle>
              <DialogDescription>Treść zapisywana jest jako HTML. Podgląd po prawej pokazuje stronę tak, jak zobaczy ją klient.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Tytuł" htmlFor="sp-title" required className="lg:col-span-2">
                  <Input
                    id="sp-title"
                    value={editing.form.title}
                    onChange={(e) => {
                      setForm({ title: e.target.value });
                      if (!slugTouched) setForm({ slug: slugify(e.target.value) });
                    }}
                  />
                </FormField>
                <FormField label="Slug" htmlFor="sp-slug" required>
                  <Input
                    id="sp-slug"
                    value={editing.form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm({ slug: e.target.value });
                    }}
                    onBlur={(e) => setForm({ slug: slugify(e.target.value) || e.target.value })}
                  />
                </FormField>
                <FormField label="Pozycja" htmlFor="sp-position">
                  <Input id="sp-position" inputMode="numeric" value={editing.form.position} onChange={(e) => setForm({ position: e.target.value })} />
                </FormField>
                <FormField label="Tytuł SEO" htmlFor="sp-seo-title" className="lg:col-span-2">
                  <Input id="sp-seo-title" value={editing.form.seo_title} onChange={(e) => setForm({ seo_title: e.target.value })} />
                </FormField>
                <FormField label="Opis SEO" htmlFor="sp-seo-desc" className="lg:col-span-2">
                  <Input id="sp-seo-desc" value={editing.form.seo_description} onChange={(e) => setForm({ seo_description: e.target.value })} />
                </FormField>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label="Treść (prosty edytor HTML)">
                  <HtmlEditor value={editing.form.content_html} onChange={(v) => setForm({ content_html: v })} />
                </FormField>
                <div>
                  <p className="mb-1.5 text-sm font-medium">Podgląd</p>
                  <div className="max-h-[32rem] min-h-[12rem] overflow-y-auto rounded-md border bg-background p-4">
                    {editing.form.content_html.trim() ? (
                      <div className="prose-shop" dangerouslySetInnerHTML={{ __html: editing.form.content_html }} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Podgląd pojawi się po wpisaniu treści.</p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="items-center gap-4">
                <label className="flex items-center gap-2 text-sm sm:mr-auto">
                  <Switch checked={editing.form.published} onCheckedChange={(c) => setForm({ published: c })} /> Opublikowana
                </label>
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
        title="Usunąć stronę?"
        description={`Strona „${deleting?.title ?? ""}” zostanie trwale usunięta, a jej adres przestanie działać.`}
        confirmLabel="Usuń"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
