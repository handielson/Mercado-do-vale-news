const SITE_ORIGIN = 'https://mercadodovale.com.br';

export const DEFAULT_CATALOG_SEO = {
  title: 'Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE',
  description: 'Compre smartphones Xiaomi, Samsung, iPhones, tablets e eletronicos com os melhores precos em Petrolina-PE. Entrega rapida e garantia.',
  canonical: `${SITE_ORIGIN}/`,
  heading: 'Todos os Produtos',
  intro: '',
  ogTitle: 'Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE',
  ogDescription: 'Smartphones, tablets e eletronicos com os melhores precos em Petrolina-PE.',
};

export const CATALOG_COLLECTIONS = [
  {
    key: 'featured',
    path: '/produtos/destaques',
    label: 'Destaques',
    heading: 'Produtos em destaque',
    intro: 'Aparelhos e eletronicos selecionados pela equipe do Mercado do Vale em Petrolina-PE.',
    title: 'Produtos em destaque | Mercado do Vale em Petrolina-PE',
    description: 'Veja smartphones, tablets e eletronicos em destaque no Mercado do Vale, com selecao especial, entrega rapida e garantia em Petrolina-PE.',
    filters: {
      sortBy: 'featured',
    },
    source: 'featured-first',
  },
  {
    key: 'recent',
    path: '/produtos/mais-recentes',
    label: 'Mais recentes',
    heading: 'Produtos mais recentes',
    intro: 'Confira os ultimos smartphones, tablets e eletronicos cadastrados no catalogo.',
    title: 'Produtos mais recentes | Mercado do Vale em Petrolina-PE',
    description: 'Confira os produtos mais recentes do Mercado do Vale: smartphones, tablets e eletronicos adicionados ao catalogo em Petrolina-PE.',
    filters: {
      sortBy: 'recent',
    },
    source: 'recent',
  },
  {
    key: 'best-sellers',
    path: '/produtos/mais-vendidos',
    label: 'Mais vendidos',
    heading: 'Produtos mais vendidos',
    intro: 'Produtos populares e recomendados pela loja. Em breve esta pagina sera ordenada automaticamente pelo ranking real de vendas.',
    title: 'Mais vendidos | Mercado do Vale em Petrolina-PE',
    description: 'Conheca os produtos populares do Mercado do Vale em Petrolina-PE, com smartphones e eletronicos selecionados pela loja.',
    filters: {
      sortBy: 'featured',
    },
    source: 'curated-featured-first-fallback',
    // Para reativar: trocar para true e descomentar a rota em routes/index.tsx
    enabled: false,
  },
];

export function getEnabledCatalogCollections() {
  return CATALOG_COLLECTIONS.filter((collection) => collection.enabled !== false);
}

export function getCatalogCollectionByPathname(pathname = '') {
  return CATALOG_COLLECTIONS.find((collection) => collection.path === pathname) || null;
}

export function isCatalogCollectionPath(pathname = '') {
  return getCatalogCollectionByPathname(pathname) !== null;
}

export function getCatalogCollectionFilters(collection) {
  return collection?.filters ? { ...collection.filters } : {};
}

export function getCatalogSeoConfig(collection) {
  if (!collection) return DEFAULT_CATALOG_SEO;

  return {
    title: collection.title,
    description: collection.description,
    canonical: `${SITE_ORIGIN}${collection.path}`,
    heading: collection.heading,
    intro: collection.intro,
    ogTitle: collection.title,
    ogDescription: collection.description,
  };
}
