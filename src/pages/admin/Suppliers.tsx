import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { SyncStatusBadge } from "@/components/admin/StatusBadge";
import { FEED_TYPES, FEED_TYPE_LABELS, errorMessage, jsonRecord, runSupplierSync } from "@/components/admin/helpers";
import { formatDate } from "@/lib/formatters";
import type { Supplier, SyncRun, Update } from "@/types";

function errorsCount(errors: Json): number {
  if (Array.isArray(errors)) return errors.length;
  if (errors && typeof errors === "object") return Object.keys(errors).length;
  return 0;
}

function SyncHistory({ supplierId, onShowErrors }: { supplierId: string; onShowErrors: (run: SyncRun) => void }) {
  const runs = useQuery({
    queryKey: ["admin-sync-runs", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sync_runs").select("*").eq("supplier_id", supplierId).order("started_at", { ascending: false }).limit(10);
      if (error) throw error;
      return (data ?? []) as SyncRun[];
    },
  });

  if (runs.isLoading) return <Skeleton className="h-16 w-full" />;
  if (runs.isError) return <p className="text-sm text-destructive">{errorMessage(runs.error)}</p>;
  if ((runs.data ?? []).length === 0) return <p className="text-sm text-muted-foreground">Brak zapisanych uruchomień synchronizacji.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Start</TableHead>
          <TableHead>Koniec</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pozycje</TableHead>
          <TableHead className="text-right">Nowe</TableHead>
          <TableHead className="text-right">Zaktualizowane</TableHead>
          <TableHead className="text-right">Bez mapowania</TableHead>
          <TableHead className="text-right">Błędy</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(runs.data ?? []).map((run) => {
          const n = errorsCount(run.errors);
          return (
            <TableRow key={run.id}>
              <TableCell className="whitespace-nowrap text-xs">{formatDate(run.started_at, true)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">{formatDate(run.finished_at, true)}</TableCell>
              <TableCell>
                <SyncStatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{run.items_total}</TableCell>
              <TableCell className="text-right tabular-nums">{run.items_new}</TableCell>
              <TableCell className="text-right tabular-nums">{run.items_updated}</TableCell>
              <TableCell className="text-right tabular-nums">{run.items_unmapped}</TableCell>
              <TableCell className="text-right">
                {n > 0 ? (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => onShowErrors(run)}>
                    <AlertTriangle /> {n}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function SupplierCard({
  supplier,
  onSave,
  saving,
  onSync,
  syncing,
  onShowErrors,
}: {
  supplier: Supplier;
  onSave: (patch: Update<"suppliers">) => void;
  saving: boolean;
  onSync: () => void;
  syncing: boolean;
  onShowErrors: (run: SyncRun) => void;
}) {
  const [priority, setPriority] = useState(String(supplier.priority));
  const [interval, setInterval] = useState(String(supplier.sync_interval_min));
  const [feedType, setFeedType] = useState(supplier.feed_type);
  const [configText, setConfigText] = useState(JSON.stringify(supplier.feed_config ?? {}, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);
  const [history, setHistory] = useState(false);

  const parseConfig = (): Record<string, Json | undefined> | null => {
    try {
      const parsed: unknown = configText.trim() ? JSON.parse(configText) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setConfigError("Konfiguracja musi być obiektem JSON, np. { \"url\": \"…\" }");
        return null;
      }
      setConfigError(null);
      return parsed as Record<string, Json | undefined>;
    } catch (e) {
      setConfigError(`Niepoprawny JSON: ${errorMessage(e)}`);
      return null;
    }
  };

  const autoCreate = (() => {
    try {
      const parsed: unknown = JSON.parse(configText);
      return Boolean(jsonRecord(parsed as Json).auto_create_products);
    } catch {
      return Boolean(jsonRecord(supplier.feed_config).auto_create_products);
    }
  })();

  const toggleAutoCreate = (checked: boolean) => {
    const cfg = parseConfig();
    if (!cfg) {
      toast.error("Popraw JSON konfiguracji, aby zmienić tę opcję");
      return;
    }
    cfg.auto_create_products = checked;
    setConfigText(JSON.stringify(cfg, null, 2));
  };

  const save = () => {
    const p = Number(priority);
    const i = Number(interval);
    if (!Number.isInteger(p)) {
      toast.error("Priorytet musi być liczbą całkowitą");
      return;
    }
    if (!Number.isInteger(i) || i < 5) {
      toast.error("Interwał synchronizacji musi być liczbą minut (min. 5)");
      return;
    }
    const cfg = parseConfig();
    if (!cfg) return;
    onSave({ priority: p, sync_interval_min: i, feed_type: feedType, feed_config: cfg as NonNullable<Json> });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {supplier.name}
            <span className="font-mono text-xs font-normal text-muted-foreground">{supplier.code}</span>
            <SyncStatusBadge status={supplier.last_sync_status} />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ostatni sync: {formatDate(supplier.last_sync_at, true)}
            {supplier.last_sync_log && <span className="ml-1">· {supplier.last_sync_log}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={supplier.active} disabled={saving} onCheckedChange={(c) => onSave({ active: c })} aria-label="Aktywna" />
            Aktywna
          </label>
          <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Synchronizuj teraz
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Priorytet" htmlFor={`prio-${supplier.id}`} hint="Niższy = preferowana przy równej cenie">
            <Input id={`prio-${supplier.id}`} inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </FormField>
          <FormField label="Interwał synchronizacji (min)" htmlFor={`int-${supplier.id}`}>
            <Input id={`int-${supplier.id}`} inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value)} />
          </FormField>
          <FormField label="Typ feedu" htmlFor={`feed-${supplier.id}`}>
            <Select value={feedType} onValueChange={setFeedType}>
              <SelectTrigger id={`feed-${supplier.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEED_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FEED_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="Konfiguracja feedu (JSON)" htmlFor={`cfg-${supplier.id}`} error={configError ?? undefined} hint="Dane dostępowe (klucze API, hasła) trzymaj w sekretach Edge Function, nie tutaj.">
          <Textarea
            id={`cfg-${supplier.id}`}
            value={configText}
            rows={5}
            className="font-mono text-xs"
            onChange={(e) => {
              setConfigText(e.target.value);
              if (configError) setConfigError(null);
            }}
          />
        </FormField>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={autoCreate} onCheckedChange={(c) => toggleAutoCreate(c === true)} />
            Automatycznie twórz ukryte produkty z niedopasowanych ofert
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistory((h) => !h)}>
              {history ? <ChevronUp /> : <ChevronDown />} Historia
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Zapisz
            </Button>
          </div>
        </div>
        {history && (
          <div className="rounded-md border">
            <SyncHistory supplierId={supplier.id} onShowErrors={onShowErrors} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Suppliers() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorsRun, setErrorsRun] = useState<SyncRun | null>(null);

  const suppliers = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("priority");
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Update<"suppliers"> }) => {
      setSavingId(id);
      const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zapisano ustawienia hurtowni");
      qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
      qc.invalidateQueries({ queryKey: ["admin-suppliers-lite"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Nie udało się zapisać ustawień")),
    onSettled: () => setSavingId(null),
  });

  const sync = async (supplier: Supplier) => {
    setSyncing(supplier.code);
    try {
      const result = await runSupplierSync(supplier.code);
      if (result.ok) toast.success(`${supplier.name}: ${result.message}`);
      else toast.warning(`${supplier.name}: ${result.message}`);
    } catch (e) {
      toast.error(errorMessage(e, "Synchronizacja nie powiodła się"));
    } finally {
      setSyncing(null);
      qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
      qc.invalidateQueries({ queryKey: ["admin-sync-runs", supplier.id] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-unmapped-offers"] });
    }
  };

  return (
    <div>
      <Seo noindex title="Hurtownie · Panel admina" />
      <PageHeader title="Hurtownie" description="Konfiguracja feedów, ręczna synchronizacja i historia ostatnich uruchomień." />
      {suppliers.isError && <p className="mb-4 text-sm text-destructive">{errorMessage(suppliers.error)}</p>}
      {suppliers.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (suppliers.data ?? []).length === 0 ? (
        <EmptyState title="Brak hurtowni" description="Hurtownie dodaje się migracją / seedem w bazie danych." />
      ) : (
        <div className="space-y-4">
          {(suppliers.data ?? []).map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              saving={savingId === s.id && update.isPending}
              onSave={(patch) => update.mutate({ id: s.id, patch })}
              syncing={syncing === s.code}
              onSync={() => sync(s)}
              onShowErrors={setErrorsRun}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(errorsRun)} onOpenChange={(o) => !o && setErrorsRun(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Błędy synchronizacji</DialogTitle>
            <DialogDescription>Uruchomienie z {formatDate(errorsRun?.started_at, true)}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-secondary p-3 text-xs">{JSON.stringify(errorsRun?.errors ?? [], null, 2)}</pre>
          <Badge variant="outline" className="w-fit">
            {errorsCount(errorsRun?.errors ?? [])} wpisów
          </Badge>
        </DialogContent>
      </Dialog>
    </div>
  );
}
