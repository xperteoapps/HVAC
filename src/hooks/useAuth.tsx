import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileWithGroup } from "@/types";
import { B2C_CONTEXT, toNumber, type PricingContext } from "@/lib/pricing";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: ProfileWithGroup | null;
  loading: boolean;
  isAdmin: boolean;
  isB2B: boolean;
  /** Kontekst cen: B2C brutto lub B2B netto z rabatem grupy */
  pricing: PricingContext;
  /** Ręczne przełączenie prezentacji brutto/netto (nie zmienia rabatu) */
  priceMode: "gross" | "net";
  setPriceMode: (mode: "gross" | "net") => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const PRICE_MODE_KEY = "hvac-price-mode";

async function loadProfile(userId: string): Promise<ProfileWithGroup | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, customer_group:customer_groups(code, name, discount_pct, price_mode)")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Nie udało się pobrać profilu", error);
    return null;
  }
  return (data as ProfileWithGroup | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileWithGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceModeOverride, setPriceModeOverride] = useState<"gross" | "net" | null>(() => {
    try {
      const v = localStorage.getItem(PRICE_MODE_KEY);
      return v === "gross" || v === "net" ? v : null;
    } catch {
      return null;
    }
  });

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfile(await loadProfile(userId));
  }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    // Najpierw listener, potem getSession — zgodnie z zaleceniami Supabase.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (newSession?.user) {
        // setTimeout — nie wywołuj zapytań synchronicznie w callbacku auth
        setTimeout(() => {
          loadProfile(newSession.user.id).then((p) => active && setProfile(p));
        }, 0);
      } else {
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).then((p) => {
          if (active) {
            setProfile(p);
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = profile?.role === "admin" || profile?.role === "staff";
  const isB2B = Boolean(profile?.b2b_approved);

  const pricing = useMemo<PricingContext>(() => {
    if (!isB2B || !profile?.customer_group) return { ...B2C_CONTEXT, mode: priceModeOverride ?? "gross" };
    const groupMode = (profile.customer_group.price_mode as "gross" | "net") ?? "net";
    return { mode: priceModeOverride ?? groupMode, discountPct: toNumber(profile.customer_group.discount_pct, 0) };
  }, [isB2B, profile, priceModeOverride]);

  const setPriceMode = useCallback((mode: "gross" | "net") => {
    setPriceModeOverride(mode);
    try {
      localStorage.setItem(PRICE_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAdmin,
    isB2B,
    pricing,
    priceMode: pricing.mode,
    setPriceMode,
    refreshProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi być użyty wewnątrz AuthProvider");
  return ctx;
}
