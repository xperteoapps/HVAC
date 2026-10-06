import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SearchInput } from "@/components/admin/SearchInput";
import { NONE_VALUE, ROLE_LABELS, errorMessage, sanitizeSearch, sendEmailBestEffort } from "@/components/admin/helpers";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatNip } from "@/lib/formatters";
import type { CustomerGroup, Profile, Update } from "@/types";

const ROLES = ["customer", "staff", "admin"] as const;
const LOAD_LIMIT = 200;

export function Customers() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);

  const groups = useQuery({
    queryKey: ["admin-customer-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_groups").select("*").order("discount_pct");
      if (error) throw error;
      return (data ?? []) as CustomerGroup[];
    },
  });

  const profiles = useQuery({
    queryKey: ["admin-profiles", { search, pendingOnly }],
    queryFn: async () => {
      let q = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(LOAD_LIMIT);
      if (pendingOnly) q = q.eq("b2b_requested", true).eq("b2b_approved", false);
      const s = sanitizeSearch(search);
      if (s) q = q.or(`email.ilike.%${s}%,full_name.ilike.%${s}%,company_name.ilike.%${s}%,nip.ilike.%${s}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch, label }: { id: string; patch: Update<"profiles">; label?: string }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
      return label ?? "Zapisano";
    },
    onSuccess: (label) => {
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać zmian")),
  });

  const approveB2B = async (p: Profile, approved: boolean) => {
    const list = groups.data ?? [];
    const b2c = list.find((g) => g.code === "b2c");
    const standard = list.find((g) => g.code === "b2b_standard");
    const patch: Update<"profiles"> = { b2b_approved: approved };
    if (approved && standard && (!p.customer_group_id || p.customer_group_id === b2c?.id)) {
      patch.customer_group_id = standard.id;
    }
    try {
      await update.mutateAsync({ id: p.id, patch, label: approved ? "Konto B2B zatwierdzone" : "Cofnięto zatwierdzenie B2B" });
      if (approved) {
        await sendEmailBestEffort("b2b_approved", { to: p.email, name: p.full_name ?? p.company_name ?? p.email });
      }
    } catch {
      /* błąd już pokazany przez onError */
    }
  };

  const rows = profiles.data ?? [];
  const groupName = (id: string | null) => (groups.data ?? []).find((g) => g.id === id)?.name ?? null;

  return (
    <div>
      <Seo noindex title="Klienci · Panel admina" />
      <PageHeader title="Klienci" description="Zatwierdzanie kont B2B, przypisywanie grup rabatowych i ról." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="E-mail, imię, firma lub NIP…" className="sm:max-w-sm" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={pendingOnly} onCheckedChange={(c) => setPendingOnly(c === true)} />
          Tylko oczekujące wnioski B2B
        </label>
      </div>

      {profiles.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(profiles.error)}</p>}

      {profiles.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Brak klientów" description={pendingOnly ? "Nie ma oczekujących wniosków B2B." : "Nie znaleziono klientów spełniających kryteria."} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead>Firma / NIP</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Grupa</TableHead>
                <TableHead>B2B</TableHead>
                <TableHead>Płatność odroczona</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const self = p.id === user?.id;
                const pending = p.b2b_requested && !p.b2b_approved;
                return (
                  <TableRow key={p.id} className={pending ? "bg-warning/10" : undefined}>
                    <TableCell>
                      <p className="font-medium">{p.email}</p>
                      <p className="text-xs text-muted-foreground">
                        od {formatDate(p.created_at)}
                        {p.phone && ` · ${p.phone}`}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{p.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      <p>{p.company_name ?? <span className="text-muted-foreground">—</span>}</p>
                      {p.nip && <p className="font-mono text-xs text-muted-foreground">NIP {formatNip(p.nip)}</p>}
                    </TableCell>
                    <TableCell>
                      <Select value={p.role} disabled={self || update.isPending} onValueChange={(v) => update.mutate({ id: p.id, patch: { role: v }, label: `Rola: ${ROLE_LABELS[v] ?? v}` })}>
                        <SelectTrigger className="h-8 w-36 text-xs" aria-label="Rola">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.customer_group_id ?? NONE_VALUE}
                        disabled={update.isPending}
                        onValueChange={(v) =>
                          update.mutate({
                            id: p.id,
                            patch: { customer_group_id: v === NONE_VALUE ? null : v },
                            label: `Grupa: ${v === NONE_VALUE ? "brak" : (groupName(v) ?? v)}`,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-xs" aria-label="Grupa klienta">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>— brak —</SelectItem>
                          {(groups.data ?? []).map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name} ({g.discount_pct}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={p.b2b_approved} disabled={update.isPending} onCheckedChange={(c) => approveB2B(p, c)} aria-label="Konto B2B zatwierdzone" />
                        {pending && (
                          <Button size="sm" variant="accent" className="h-7 px-2 text-xs" disabled={update.isPending} onClick={() => approveB2B(p, true)}>
                            <BadgeCheck /> Zatwierdź
                          </Button>
                        )}
                        {!pending && p.b2b_requested && !p.b2b_approved && <Badge variant="warning">wniosek</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.deferred_payment_allowed}
                        disabled={update.isPending}
                        onCheckedChange={(c) => update.mutate({ id: p.id, patch: { deferred_payment_allowed: c }, label: c ? "Włączono płatność odroczoną" : "Wyłączono płatność odroczoną" })}
                        aria-label="Płatność odroczona"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length >= LOAD_LIMIT && <p className="border-t p-3 text-xs text-muted-foreground">Wyświetlono {LOAD_LIMIT} najnowszych kont — użyj wyszukiwarki, aby znaleźć pozostałe.</p>}
        </Card>
      )}
    </div>
  );
}
