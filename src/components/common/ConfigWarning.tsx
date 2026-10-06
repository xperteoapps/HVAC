import { AlertTriangle } from "lucide-react";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export function ConfigWarning() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="bg-warning px-4 py-2 text-center text-xs font-medium text-warning-foreground">
      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
      Brak konfiguracji Supabase — ustaw VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY w pliku .env
    </div>
  );
}
