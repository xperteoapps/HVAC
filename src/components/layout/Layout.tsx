import { Outlet, ScrollRestoration } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "./CookieConsent";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { ConfigWarning } from "@/components/common/ConfigWarning";
import { useCartSync } from "@/hooks/useCartSync";

export function Layout() {
  useCartSync();
  return (
    <div className="flex min-h-screen flex-col">
      <ConfigWarning />
      <Header />
      <main className="container flex-1 py-6">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <CookieConsent />
      <ScrollRestoration />
    </div>
  );
}
