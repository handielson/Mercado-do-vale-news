import { Link } from 'react-router-dom';

type ProductWorkspaceSection = 'product' | 'production' | 'storefronts';

type ProductWorkspaceNavProps = {
  productId: string;
  sku: string;
  active: ProductWorkspaceSection;
};

const sections: Array<{ id: ProductWorkspaceSection; label: string }> = [
  { id: 'product', label: '1. Cadastro' },
  { id: 'production', label: '2. Produção 3D' },
  { id: 'storefronts', label: '3. Sites e preços' },
];

export function ProductWorkspaceNav({ productId, sku, active }: ProductWorkspaceNavProps) {
  const targets: Record<ProductWorkspaceSection, string> = {
    product: `/admin/products/${encodeURIComponent(productId)}`,
    production: `/admin/loja-3d/calculadora?product_id=${encodeURIComponent(productId)}#ficha-producao-3d`,
    storefronts: `/admin/products/storefronts?sku=${encodeURIComponent(sku)}`,
  };

  return (
    <nav aria-label="Etapas do produto" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {sections.map((section) => section.id === active ? (
        <span key={section.id} aria-current="page" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          {section.label}
        </span>
      ) : (
        <Link key={section.id} to={targets[section.id]} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50">
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
