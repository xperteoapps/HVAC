import { Link } from "react-router-dom";
import { ChevronRight, LogIn, Menu, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { SearchBox } from "./SearchBox";
import { PriceModeToggle } from "./PriceModeToggle";

export function MobileNav() {
  const { data } = useCategories();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[85vw] max-w-sm flex-col overflow-y-auto p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          <SearchBox onNavigate={close} />
        </div>
        <Accordion type="multiple" className="px-4">
          {(data?.tree ?? []).map((cat) => (
            <AccordionItem key={cat.id} value={cat.id}>
              <AccordionTrigger className="text-base">{cat.name}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1">
                  <li>
                    <Link to={`/kategoria/${cat.slug}`} onClick={close} className="flex items-center justify-between py-1.5 text-sm font-medium text-accent">
                      Wszystko w: {cat.name} <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                  {cat.children.map((child) => (
                    <li key={child.id}>
                      <Link to={`/kategoria/${child.slug}`} onClick={close} className="flex items-center justify-between py-1.5 text-sm">
                        {child.name}
                        <span className="text-xs text-muted-foreground">{child.product_count}</span>
                      </Link>
                      {child.children.length > 0 && (
                        <ul className="ml-3 border-l pl-3">
                          {child.children.map((g) => (
                            <li key={g.id}>
                              <Link to={`/kategoria/${g.slug}`} onClick={close} className="block py-1 text-sm text-muted-foreground">
                                {g.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="mt-auto space-y-3 border-t p-4">
          <PriceModeToggle />
          <Link to="/b2b" onClick={close} className="block text-sm font-medium text-accent">
            Strefa B2B
          </Link>
          {user ? (
            <>
              <Link to="/konto" onClick={close} className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" /> Moje konto
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={close} className="block text-sm">
                  Panel admina
                </Link>
              )}
            </>
          ) : (
            <Link to="/logowanie" onClick={close} className="flex items-center gap-2 text-sm">
              <LogIn className="h-4 w-4" /> Zaloguj się
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
