import { Link, useParams } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useStaticPage } from "@/hooks/useStaticPage";

export default function StaticPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isLoading } = useStaticPage(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!page) {
    return <EmptyState title="Strona nie istnieje" action={<Button asChild><Link to="/">Strona główna</Link></Button>} />;
  }
  return (
    <article className="mx-auto max-w-3xl">
      <Seo title={page.seo_title ?? page.title} description={page.seo_description} path={`/strona/${page.slug}`} />
      <Breadcrumbs items={[{ name: page.title, path: `/strona/${page.slug}` }]} />
      <h1 className="mb-6 text-3xl font-bold">{page.title}</h1>
      <div className="prose-shop rounded-lg border bg-card p-6" dangerouslySetInnerHTML={{ __html: page.content_html }} />
    </article>
  );
}
