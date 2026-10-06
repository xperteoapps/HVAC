import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { canonical, pageTitle } from "@/lib/seo";

interface SeoProps {
  title?: string | null;
  description?: string | null;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  noindex?: boolean;
  image?: string | null;
  /** Ścieżka canonical (domyślnie bieżąca bez query) */
  path?: string;
}

export function Seo({ title, description, jsonLd, noindex, image, path }: SeoProps) {
  const location = useLocation();
  const url = canonical(path ?? location.pathname);
  const fullTitle = pageTitle(title);
  const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      {image && <meta property="og:image" content={image} />}
      {jsonLdList.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
