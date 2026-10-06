import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  FolderTree,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Percent,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Seo } from "@/components/common/Seo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/zamowienia", label: "Zamówienia", icon: ShoppingCart },
  { to: "/admin/produkty", label: "Produkty", icon: Package },
  { to: "/admin/mapowanie", label: "Mapowanie ofert", icon: Link2 },
  { to: "/admin/marze", label: "Reguły marż", icon: Percent },
  { to: "/admin/hurtownie", label: "Hurtownie", icon: Truck },
  { to: "/admin/klienci", label: "Klienci", icon: Users },
  { to: "/admin/kategorie", label: "Kategorie", icon: FolderTree },
  { to: "/admin/marki", label: "Marki", icon: Tag },
  { to: "/admin/dostawa", label: "Metody dostawy", icon: PackageCheck },
  { to: "/admin/strony", label: "Strony", icon: FileText },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Nawigacja panelu">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminLayout() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const currentLabel = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label ?? "Panel admina";

  const userBlock = (
    <div className="border-t p-3 text-xs">
      <p className="truncate font-medium text-foreground">{profile?.full_name || user?.email}</p>
      <p className="truncate text-muted-foreground">{user?.email}</p>
      <div className="mt-2 flex gap-1">
        <Button asChild variant="ghost" size="sm" className="h-8 flex-1 justify-start px-2">
          <Link to="/">
            <ArrowLeft /> Sklep
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Wyloguj" onClick={() => signOut()}>
          <LogOut />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      <Seo noindex title="Panel admina" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-accent">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">Panel admina</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList />
        </div>
        {userBlock}
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Otwórz menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle>Panel admina</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-3">
              <NavList onNavigate={() => setOpen(false)} />
            </div>
            {userBlock}
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-semibold">{currentLabel}</span>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link to="/">
            <ArrowLeft /> Sklep
          </Link>
        </Button>
      </header>

      <main className="px-4 py-6 lg:pl-64 lg:pr-8">
        <Outlet />
      </main>
    </div>
  );
}
