import React, { useMemo, useState } from 'react';
import { Barcode, Minus, PackagePlus, Printer, Search, Trash2, X } from 'lucide-react';
import { productService } from '../../../services/products';
import { Product } from '../../../types/product';

interface PrintListItem {
  product: Product;
  quantity: number;
}

export function InventoryPrintListPage() {
  const [boxName, setBoxName] = useState('');
  const [responsible, setResponsible] = useState('');
  const [lookup, setLookup] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [items, setItems] = useState<PrintListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalQuantity = useMemo(() => {
    return items.reduce((total, item) => total + item.quantity, 0);
  }, [items]);

  const handleSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();

    const term = lookup.trim();
    if (term.length < 2) {
      setMessage('Digite ou bipe um EAN, SKU ou nome com pelo menos 2 caracteres.');
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const cleanTerm = term.replace(/\D/g, '');
      const eanResults = cleanTerm.length >= 8 ? await productService.searchByEAN(cleanTerm) : [];
      const fallbackResults = eanResults.length > 0 ? [] : await productService.search(term);
      const nextResults = eanResults.length > 0 ? eanResults : fallbackResults;

      if (nextResults.length === 1) {
        addProduct(nextResults[0]);
        setLookup('');
        setResults([]);
        return;
      }

      setResults(nextResults);
      if (nextResults.length === 0) {
        setMessage('Nenhum produto encontrado para esta busca.');
      }
    } catch (error) {
      setMessage('Nao foi possivel buscar o produto agora.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = (product: Product) => {
    setItems((currentItems) => {
      const existing = currentItems.find((item) => item.product.id === product.id);
      if (existing) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentItems, { product, quantity: 1 }];
    });
    setMessage(null);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.product.id === productId ? { ...item, quantity: safeQuantity } : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId));
  };

  const handlePrint = () => {
    if (items.length === 0) {
      setMessage('Adicione pelo menos um item antes de imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setMessage('Permita popups para imprimir a lista.');
      return;
    }

    const createdAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());
    const safeBoxName = escapeHtml(boxName.trim() || 'Lista avulsa');
    const safeResponsible = escapeHtml(responsible.trim() || '-');

    printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Lista de Impressao - ${safeBoxName}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { color: #111827; font-family: Arial, sans-serif; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { display: grid; gap: 4px; margin-bottom: 18px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
    .qty { text-align: right; width: 56px; }
    .sku, .ean { font-family: Consolas, monospace; white-space: nowrap; }
    .footer { margin-top: 24px; display: grid; gap: 20px; grid-template-columns: 1fr 1fr; }
    .line { border-top: 1px solid #111827; padding-top: 6px; text-align: center; }
  </style>
</head>
<body>
  <h1>Lista de Impressao para Caixa / Separacao</h1>
  <div class="meta">
    <div><strong>Caixa/lote:</strong> ${safeBoxName}</div>
    <div><strong>Responsavel:</strong> ${safeResponsible}</div>
    <div><strong>Data:</strong> ${createdAt}</div>
    <div><strong>Total de itens:</strong> ${totalQuantity}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Nome</th>
        <th>Variacao</th>
        <th>SKU</th>
        <th>Codigo de barras EAN</th>
        <th class="qty">Qtd.</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => `
        <tr>
          <td>${escapeHtml(item.product.name)}</td>
          <td>${escapeHtml(formatVariation(item.product))}</td>
          <td class="sku">${escapeHtml(item.product.sku || '-')}</td>
          <td class="ean">${escapeHtml(formatEans(item.product))}</td>
          <td class="qty">${item.quantity}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    <div class="line">Separado por</div>
    <div class="line">Conferido por</div>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Printer size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lista de Impressao</h1>
            <p className="text-sm text-slate-500">Monte uma lista fisica de caixa/separacao sem baixar ou reservar estoque.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={items.length === 0}
        >
          <Printer size={16} />
          Imprimir lista
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Caixa/lote</span>
            <input
              type="text"
              value={boxName}
              onChange={(event) => setBoxName(event.target.value)}
              placeholder="Ex.: Caixa balcão 01, lote reposicao loja"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Responsavel</span>
            <input
              type="text"
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              placeholder="Nome de quem esta separando"
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Barcode size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Adicionar item</h2>
              <p className="mt-1 text-sm text-slate-500">Bipe o codigo de barras ou busque por SKU/nome.</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                placeholder="EAN, SKU ou nome do produto"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <PackagePlus size={16} />
              {loading ? 'Buscando...' : 'Adicionar'}
            </button>
          </form>

          {message && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {message}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-b border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-900">Escolha um produto</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    addProduct(product);
                    setLookup('');
                    setResults([]);
                  }}
                  className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <p className="font-semibold text-slate-900">{product.name}</p>
                  <p className="mt-1 text-xs font-mono text-slate-500">SKU: {product.sku || '-'}</p>
                  <p className="mt-1 text-xs text-slate-500">EAN: {formatEans(product)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Nome | Variacao | SKU | Codigo de barras EAN</th>
                <th className="px-5 py-3">Variacao</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">EAN</th>
                <th className="px-5 py-3 text-right">Qtd.</th>
                <th className="px-5 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    Nenhum item adicionado ainda.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.product.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">{item.product.name}</td>
                    <td className="px-5 py-4 text-slate-600">{formatVariation(item.product)}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{item.product.sku || '-'}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{formatEans(item.product)}</td>
                    <td className="px-5 py-4 text-right">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.product.id, Number(event.target.value))}
                        className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
                          aria-label="Remover item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {items.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">{items.length}</strong> produtos na lista, <strong className="text-slate-900">{totalQuantity}</strong> unidades para conferir.
          </p>
          <button
            type="button"
            onClick={() => setItems([])}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <X size={16} />
            Limpar lista
          </button>
        </div>
      )}
    </div>
  );
}

function formatEans(product: Product): string {
  return product.eans?.filter(Boolean).join(', ') || '-';
}

function formatVariation(product: Product): string {
  const specs = product.specs || {};
  const candidates = [
    specs.color,
    specs.Cor,
    specs.storage,
    specs.Armazenamento,
    specs.ram,
    specs.RAM,
    specs.version,
    specs.Versao,
    product.model,
  ];

  return candidates.filter(Boolean).slice(0, 3).join(' / ') || '-';
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
