import { NavLink, Outlet } from "react-router-dom";
import { Building2, MapPin, Package, User } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/konto", label: "Moje konto", icon: User, end: true },
  { to: "/konto/zamowienia", label: "Zamówienia", icon: Package },
  { to: "/konto/adresy", label: "Adresy", icon: MapPin },
  { to: "/konto/firma", label: "Dane firmy / B2B", icon: Building2 },
];

export default function AccountLayout() {
  const { profile, isB2B } = useAuth();
  return (
    <div>
      <Seo title="Moje konto" noindex />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Moje konto</h1>
        {isB2B && <Badge variant="accent">B2B · {profile?.customer_group?.name}</Badge>}
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Konto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn("flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary", isActive && "bg-secondary text-accent")
              }
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
