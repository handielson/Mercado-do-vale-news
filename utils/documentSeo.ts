export type DocumentSeo = {
  description: string;
  robots: string;
  canonical: string;
  openGraph?: Record<string, string>;
  twitter?: Record<string, string>;
};

function syncMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  const tags = Array.from(document.head.querySelectorAll(selector));
  let tag = tags[0] as HTMLMetaElement | undefined;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
  tags.slice(1).forEach(duplicate => duplicate.remove());
}

export function syncDocumentSeo(seo: DocumentSeo) {
  syncMeta('meta[name="description"]', 'name', 'description', seo.description);
  syncMeta('meta[name="robots"]', 'name', 'robots', seo.robots);

  const canonicals = Array.from(document.head.querySelectorAll('link[rel="canonical"]'));
  let canonical = canonicals[0] as HTMLLinkElement | undefined;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = seo.canonical;
  canonicals.slice(1).forEach(duplicate => duplicate.remove());

  Object.entries(seo.openGraph || {}).forEach(([property, content]) =>
    syncMeta(`meta[property="${property}"]`, 'property', property, content));
  Object.entries(seo.twitter || {}).forEach(([name, content]) =>
    syncMeta(`meta[name="${name}"]`, 'name', name, content));
}
