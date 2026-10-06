import { Link } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <Seo title="Strona nie istnieje" noindex />
      <EmptyState
        title="404 — nie znaleziono strony"
        description="Adres mógł się zmienić. Skorzystaj z wyszukiwarki lub wróć na stronę główną."
        action={
          <Button asChild>
            <Link to="/">Strona główna</Link>
          </Button>
        }
      />
    </>
  );
}
