import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import Product from "@/pages/Product";
import Search from "@/pages/Search";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirm from "@/pages/OrderConfirm";
import StaticPage from "@/pages/StaticPage";
import B2B from "@/pages/B2B";
import NotFound from "@/pages/NotFound";
import { Login, Register } from "@/pages/Auth";
import AccountLayout from "@/pages/account/AccountLayout";
import AccountHome from "@/pages/account/AccountHome";
import { OrdersList, OrderDetail } from "@/pages/account/Orders";
import Addresses from "@/pages/account/Addresses";
import CompanyData from "@/pages/account/CompanyData";

const AdminLayout = lazy(() => import("@/components/layout/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const admin = (name: keyof typeof import("@/pages/admin")) => lazy(() => import("@/pages/admin").then((m) => ({ default: m[name] })));
const AdminDashboard = admin("AdminDashboard");
const AdminOrders = admin("AdminOrders");
const AdminOrderDetails = admin("AdminOrderDetails");
const AdminProducts = admin("AdminProducts");
const AdminOfferMapping = admin("AdminOfferMapping");
const AdminMarginRules = admin("AdminMarginRules");
const AdminSuppliers = admin("AdminSuppliers");
const AdminCustomers = admin("AdminCustomers");
const AdminCategories = admin("AdminCategories");
const AdminBrands = admin("AdminBrands");
const AdminShippingMethods = admin("AdminShippingMethods");
const AdminStaticPages = admin("AdminStaticPages");

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30 * 1000, retry: 1, refetchOnWindowFocus: false } },
});

function Fallback() {
  return (
    <div className="space-y-3 py-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Providers() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Outlet />
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Home /> },
          { path: "/kategoria/:slug", element: <Category /> },
          { path: "/produkt/:slug", element: <Product /> },
          { path: "/szukaj", element: <Search /> },
          { path: "/koszyk", element: <Cart /> },
          { path: "/zamowienie", element: <Checkout /> },
          { path: "/zamowienie/potwierdzenie/:number", element: <OrderConfirm /> },
          { path: "/strona/:slug", element: <StaticPage /> },
          { path: "/b2b", element: <B2B /> },
          { path: "/logowanie", element: <Login /> },
          { path: "/rejestracja", element: <Register /> },
          {
            element: <ProtectedRoute />,
            children: [
              {
                path: "/konto",
                element: <AccountLayout />,
                children: [
                  { index: true, element: <AccountHome /> },
                  { path: "zamowienia", element: <OrdersList /> },
                  { path: "zamowienia/:id", element: <OrderDetail /> },
                  { path: "adresy", element: <Addresses /> },
                  { path: "firma", element: <CompanyData /> },
                ],
              },
            ],
          },
          { path: "*", element: <NotFound /> },
        ],
      },
      {
        element: <ProtectedRoute admin />,
        children: [
          {
            path: "/admin",
            element: (
              <Suspense fallback={<Fallback />}>
                <AdminLayout />
              </Suspense>
            ),
            children: [
              { index: true, element: <AdminDashboard /> },
              { path: "zamowienia", element: <AdminOrders /> },
              { path: "zamowienia/:id", element: <AdminOrderDetails /> },
              { path: "produkty", element: <AdminProducts /> },
              { path: "mapowanie", element: <AdminOfferMapping /> },
              { path: "marze", element: <AdminMarginRules /> },
              { path: "hurtownie", element: <AdminSuppliers /> },
              { path: "klienci", element: <AdminCustomers /> },
              { path: "kategorie", element: <AdminCategories /> },
              { path: "marki", element: <AdminBrands /> },
              { path: "dostawa", element: <AdminShippingMethods /> },
              { path: "strony", element: <AdminStaticPages /> },
            ].map((r) => ({ ...r, element: <Suspense fallback={<Fallback />}>{r.element}</Suspense> })),
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </HelmetProvider>
  );
}
