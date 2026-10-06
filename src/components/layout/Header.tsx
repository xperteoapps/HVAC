import { Link, useNavigate } from "react-router-dom";
import { LogOut, Package, Settings, ShoppingCart, User, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { selectCartCount, useCartStore } from "@/lib/cart-store";
import { SITE_NAME } from "@/lib/seo";
import { SearchBox } from "./SearchBox";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { PriceModeToggle } from "./PriceModeToggle";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { user, profile, isAdmin, isB2B, signOut } = useAuth();
  const count = useCartStore(selectCartCount);
  const setOpen = useCartStore((s) => s.setOpen);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="hidden border-b bg-secondary/60 text-xs text-muted-foreground md:block">
        <div className="container flex h-8 items-center justify-between">
          <span>Dostawa paletowa w całej Polsce · Doradztwo techniczne · Ceny B2B dla instalatorów</span>
          <div className="flex items-center gap-4">
            <Link to="/strona/dostawa-i-platnosc" className="hover:text-foreground">
              Dostawa i płatność
            </Link>
            <Link to="/strona/kontakt" className="hover:text-foreground">
              Kontakt
            </Link>
          </div>
        </div>
      </div>
      <div className="container flex h-16 items-center gap-2 sm:gap-4">
        <MobileNav />
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={SITE_NAME}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-accent">
            <Wind className="h-5 w-5" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:inline">{SITE_NAME}</span>
        </Link>
        <SearchBox className="hidden flex-1 md:block md:max-w-xl" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <PriceModeToggle className="hidden sm:inline-flex" />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Konto">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate text-sm font-medium">{profile?.full_name || user.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  {isB2B && (
                    <Badge variant="accent" className="mt-1">
                      Konto B2B
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/konto")}>
                  <User /> Moje konto
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/konto/zamowienia")}>
                  <Package /> Zamówienia
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onSelect={() => navigate("/admin")}>
                    <Settings /> Panel admina
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()}>
                  <LogOut /> Wyloguj
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/logowanie">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Zaloguj</span>
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="relative" onClick={() => setOpen(true)} aria-label={`Koszyk, ${count} szt.`}>
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                {count}
              </span>
            )}
          </Button>
        </div>
      </div>
      <div className="container pb-3 md:hidden">
        <SearchBox />
      </div>
      <MegaMenu />
    </header>
  );
}
