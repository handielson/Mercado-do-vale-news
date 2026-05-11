import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, Boxes, Building2, History, Loader2, MapPin, PackageSearch, Plus, RefreshCw, Search, X } from 'lucide-react';
import { stockLocationService } from '../../../services/stockLocationService';
import {
  ProductStockLocation,
  StockDeposit,
  StockLocation,
  StockLocationDivergence,
  StockLocationMovement,
  StockLocationProductSearchResult,
} from '../../../types/stock-location';

export function StockLocationsPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search')?.trim() || '';
  const [deposits, setDeposits] = useState<StockDeposit[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [divergences, setDivergences] = useState<StockLocationDivergence[]>([]);
  const [movements, setMovements] = useState<StockLocationMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDepositId, setSelectedDepositId] = useState<string>('all');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<StockLocationProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StockLocationProductSearchResult | null>(null);
  const [productDistribution, setProductDistribution] = useState<ProductStockLocation[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryDepositId, setEntryDepositId] = useState('');
  const [entryLocationId, setEntryLocationId] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('1');
  const [entryReason, setEntryReason] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entrySaving, setEntrySaving] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentDepositId, setAdjustmentDepositId] = useState('');
  const [adjustmentLocationId, setAdjustmentLocationId] = useState('');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromDepositId, setTransferFromDepositId] = useState('');
  const [transferFromLocationId, setTransferFromLocationId] = useState('');
  const [transferToDepositId, setTransferToDepositId] = useState('');
  const [transferToLocationId, setTransferToLocationId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialSearch) {
      setProductSearch(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    const term = productSearch.trim();

    if (term.length < 2) {
      setProductResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await stockLocationService.searchProducts(term);
        setProductResults(results);
      } catch (error) {
        setProductResults([]);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [productSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [depositData, locationData, divergenceData, movementData] = await Promise.all([
        stockLocationService.listDeposits(),
        stockLocationService.listLocations(),
        stockLocationService.getStockDivergences(),
        stockLocationService.listMovements({ limit: 20 }),
      ]);

      setDeposits(depositData);
      setLocations(locationData);
      setDivergences(divergenceData);
      setMovements(movementData);
    } catch (error) {
      setLoadError('Estrutura ainda não aplicada. Execute a migration multi-depósitos antes de usar a conferência com dados reais.');
    } finally {
      setLoading(false);
    }
  };

  const depositById = useMemo(() => {
    return deposits.reduce<Record<string, StockDeposit>>((acc, deposit) => {
      acc[deposit.id] = deposit;
      return acc;
    }, {});
  }, [deposits]);

  const filteredLocations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return locations.filter((location) => {
      const deposit = depositById[location.deposit_id];
      const matchesDeposit = selectedDepositId === 'all' || location.deposit_id === selectedDepositId;
      const matchesSearch = !term ||
        location.name.toLowerCase().includes(term) ||
        location.code.toLowerCase().includes(term) ||
        deposit?.name.toLowerCase().includes(term);

      return matchesDeposit && matchesSearch;
    });
  }, [depositById, locations, search, selectedDepositId]);

  const activeDeposits = deposits.filter((deposit) => deposit.is_active).length;
  const activeLocations = locations.filter((location) => location.is_active).length;

  const loadProductDistribution = async (productId: string) => {
    const distribution = await stockLocationService.getProductStockDistribution(productId);
    setProductDistribution(distribution);
    return distribution;
  };

  const selectProduct = async (product: StockLocationProductSearchResult) => {
    try {
      setSelectedProduct(product);
      setProductSearch(product.name);
      setProductResults([]);
      setProductLoading(true);
      setProductError(null);

      await loadProductDistribution(product.id);
    } catch (error) {
      setProductDistribution([]);
      setProductError('Não foi possível carregar a distribuição deste produto. Confira se a migration já foi aplicada.');
    } finally {
      setProductLoading(false);
    }
  };

  const openEntryModal = () => {
    const defaultDepositId = deposits.find((deposit) => deposit.is_default)?.id || deposits[0]?.id || '';
    const firstLocation = locations.find((location) => location.deposit_id === defaultDepositId);

    setEntryDepositId(defaultDepositId);
    setEntryLocationId(firstLocation?.id || '');
    setEntryQuantity('1');
    setEntryReason('');
    setEntryNotes('');
    setEntryError(null);
    setEntryOpen(true);
  };

  const closeEntryModal = () => {
    if (entrySaving) return;
    setEntryOpen(false);
  };

  const openAdjustmentModal = () => {
    const firstDistribution = productDistribution[0];
    const firstDepositId = firstDistribution?.deposit_id || deposits.find((deposit) => deposit.is_default)?.id || deposits[0]?.id || '';
    const firstLocation = locations.find((location) => location.deposit_id === firstDepositId);
    const firstLocationId = firstDistribution?.location_id || firstLocation?.id || '';

    setAdjustmentDepositId(firstDepositId);
    setAdjustmentLocationId(firstLocationId);
    setAdjustmentQuantity(firstDistribution ? String(firstDistribution.quantity) : '0');
    setAdjustmentReason('');
    setAdjustmentNotes('');
    setAdjustmentError(null);
    setAdjustmentOpen(true);
  };

  const closeAdjustmentModal = () => {
    if (adjustmentSaving) return;
    setAdjustmentOpen(false);
  };

  const getDistributionByLocation = (locationId: string) => {
    return productDistribution.find((item) => item.location_id === locationId);
  };

  const openTransferModal = () => {
    const sourceDistribution =
      productDistribution.find((item) => item.quantity - item.reserved_quantity > 0) ||
      productDistribution[0];
    const sourceDepositId = sourceDistribution?.deposit_id || deposits.find((deposit) => deposit.is_default)?.id || deposits[0]?.id || '';
    const sourceLocation = locations.find((location) => location.id === sourceDistribution?.location_id) ||
      locations.find((location) => location.deposit_id === sourceDepositId);
    const targetDepositId = deposits.find((deposit) => deposit.id !== sourceDepositId)?.id || sourceDepositId;
    const targetLocation = locations.find((location) => location.deposit_id === targetDepositId && location.id !== sourceLocation?.id) ||
      locations.find((location) => location.id !== sourceLocation?.id);
    const available = sourceDistribution ? sourceDistribution.quantity - sourceDistribution.reserved_quantity : 0;

    setTransferFromDepositId(sourceDepositId);
    setTransferFromLocationId(sourceLocation?.id || '');
    setTransferToDepositId(targetLocation?.deposit_id || targetDepositId);
    setTransferToLocationId(targetLocation?.id || '');
    setTransferQuantity(available > 0 ? '1' : '');
    setTransferReason('');
    setTransferNotes('');
    setTransferError(null);
    setTransferOpen(true);
  };

  const closeTransferModal = () => {
    if (transferSaving) return;
    setTransferOpen(false);
  };

  const handleAdjustmentDepositChange = (depositId: string) => {
    const firstLocation = locations.find((location) => location.deposit_id === depositId);
    const distribution = productDistribution.find((item) => item.deposit_id === depositId && item.location_id === firstLocation?.id);

    setAdjustmentDepositId(depositId);
    setAdjustmentLocationId(firstLocation?.id || '');
    setAdjustmentQuantity(distribution ? String(distribution.quantity) : '0');
  };

  const handleEntryDepositChange = (depositId: string) => {
    const firstLocation = locations.find((location) => location.deposit_id === depositId);

    setEntryDepositId(depositId);
    setEntryLocationId(firstLocation?.id || '');
  };

  const handleAdjustmentLocationChange = (locationId: string) => {
    const distribution = productDistribution.find((item) => item.location_id === locationId);

    setAdjustmentLocationId(locationId);
    setAdjustmentQuantity(distribution ? String(distribution.quantity) : '0');
  };

  const handleTransferFromDepositChange = (depositId: string) => {
    const firstLocation = locations.find((location) => location.deposit_id === depositId);

    setTransferFromDepositId(depositId);
    setTransferFromLocationId(firstLocation?.id || '');
  };

  const handleTransferToDepositChange = (depositId: string) => {
    const firstLocation = locations.find((location) => location.deposit_id === depositId && location.id !== transferFromLocationId);

    setTransferToDepositId(depositId);
    setTransferToLocationId(firstLocation?.id || '');
  };

  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProduct) return;

    const quantity = Number(entryQuantity);

    if (!entryDepositId || !entryLocationId) {
      setEntryError('Selecione o deposito e o local da entrada.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setEntryError('Informe uma quantidade valida.');
      return;
    }

    if (!entryReason.trim()) {
      setEntryError('Informe o motivo da entrada.');
      return;
    }

    try {
      setEntrySaving(true);
      setEntryError(null);

      await stockLocationService.addStockLocation({
        product_id: selectedProduct.id,
        deposit_id: entryDepositId,
        location_id: entryLocationId,
        quantity,
        reason: entryReason,
        notes: entryNotes,
      });

      const [distribution] = await Promise.all([
        loadProductDistribution(selectedProduct.id),
        stockLocationService.listMovements({ limit: 20 }).then(setMovements),
        stockLocationService.getStockDivergences().then(setDivergences),
      ]);

      setSelectedProduct({
        ...selectedProduct,
        stock_quantity: distribution.reduce((total, item) => total + item.quantity, 0),
      });
      setEntryOpen(false);
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : 'Nao foi possivel registrar a entrada.');
    } finally {
      setEntrySaving(false);
    }
  };

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProduct) return;

    const quantity = Number(adjustmentQuantity);
    if (!adjustmentDepositId || !adjustmentLocationId) {
      setAdjustmentError('Selecione o deposito e o local do ajuste.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      setAdjustmentError('Informe uma quantidade valida.');
      return;
    }

    if (!adjustmentReason.trim()) {
      setAdjustmentError('Informe o motivo do ajuste.');
      return;
    }

    try {
      setAdjustmentSaving(true);
      setAdjustmentError(null);

      await stockLocationService.adjustStockLocation({
        product_id: selectedProduct.id,
        deposit_id: adjustmentDepositId,
        location_id: adjustmentLocationId,
        quantity,
        reason: adjustmentReason,
        notes: adjustmentNotes,
      });

      const [distribution] = await Promise.all([
        loadProductDistribution(selectedProduct.id),
        stockLocationService.listMovements({ limit: 20 }).then(setMovements),
        stockLocationService.getStockDivergences().then(setDivergences),
      ]);

      setSelectedProduct({
        ...selectedProduct,
        stock_quantity: distribution.reduce((total, item) => total + item.quantity, 0),
      });
      setAdjustmentOpen(false);
    } catch (error) {
      setAdjustmentError(error instanceof Error ? error.message : 'Nao foi possivel salvar o ajuste.');
    } finally {
      setAdjustmentSaving(false);
    }
  };

  const entryLocations = locations.filter((location) => location.deposit_id === entryDepositId);
  const adjustmentLocations = locations.filter((location) => location.deposit_id === adjustmentDepositId);
  const transferFromLocations = locations.filter((location) => location.deposit_id === transferFromDepositId);
  const transferToLocations = locations.filter((location) => location.deposit_id === transferToDepositId);
  const transferSourceDistribution = getDistributionByLocation(transferFromLocationId);
  const transferSourceAvailable = transferSourceDistribution
    ? transferSourceDistribution.quantity - transferSourceDistribution.reserved_quantity
    : 0;

  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProduct) return;

    const quantity = Number(transferQuantity);

    if (!transferFromDepositId || !transferFromLocationId || !transferToDepositId || !transferToLocationId) {
      setTransferError('Selecione origem e destino da transferencia.');
      return;
    }

    if (transferFromLocationId === transferToLocationId) {
      setTransferError('A origem e destino precisam ser diferentes.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTransferError('Informe uma quantidade valida.');
      return;
    }

    if (quantity > transferSourceAvailable) {
      setTransferError('A quantidade transferida nao pode exceder a quantidade disponivel na origem.');
      return;
    }

    if (!transferReason.trim()) {
      setTransferError('Informe o motivo da transferencia.');
      return;
    }

    try {
      setTransferSaving(true);
      setTransferError(null);

      await stockLocationService.transferStockLocation({
        product_id: selectedProduct.id,
        from_deposit_id: transferFromDepositId,
        from_location_id: transferFromLocationId,
        to_deposit_id: transferToDepositId,
        to_location_id: transferToLocationId,
        quantity,
        reason: transferReason,
        notes: transferNotes,
      });

      await Promise.all([
        loadProductDistribution(selectedProduct.id),
        stockLocationService.listMovements({ limit: 20 }).then(setMovements),
        stockLocationService.getStockDivergences().then(setDivergences),
      ]);

      setTransferOpen(false);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Nao foi possivel transferir o estoque.');
    } finally {
      setTransferSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Boxes size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Locais de Estoque</h1>
            <p className="text-sm text-slate-500">Conferência de depósitos, locais internos e divergências de saldo.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-sm font-bold text-amber-900">Operacao controlada</h2>
            <p className="mt-1 text-sm text-amber-800">
              Entradas, ajustes e transferencias usam RPC com motivo obrigatorio e historico auditavel por local.
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h2 className="text-sm font-bold text-red-900">Estrutura ainda não aplicada</h2>
              <p className="mt-1 text-sm text-red-800">{loadError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Depósitos ativos" value={activeDeposits} icon={<Building2 size={22} />} />
        <MetricCard label="Locais internos" value={activeLocations} icon={<MapPin size={22} />} />
        <MetricCard label="Divergências" value={divergences.length} icon={<AlertTriangle size={22} />} tone={divergences.length ? 'warning' : 'success'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-900">Depósitos</h2>
            <p className="mt-1 text-sm text-slate-500">Pontos físicos de armazenamento cadastrados pela migration.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <LoadingBlock label="Carregando depósitos..." />
            ) : deposits.length === 0 ? (
              <EmptyBlock label="Nenhum depósito encontrado." />
            ) : (
              deposits.map((deposit) => (
                <button
                  key={deposit.id}
                  type="button"
                  onClick={() => setSelectedDepositId(deposit.id)}
                  className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${
                    selectedDepositId === deposit.id ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{deposit.name}</p>
                        {deposit.is_default && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Padrão</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{deposit.code}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{deposit.type}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Locais internos</h2>
                <p className="mt-1 text-sm text-slate-500">Prateleiras, balcões, caixas e posições dentro dos depósitos.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar local..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-64"
                  />
                </div>
                <select
                  value={selectedDepositId}
                  onChange={(event) => setSelectedDepositId(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">Todos os depósitos</option>
                  {deposits.map((deposit) => (
                    <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Local</th>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Depósito</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4}><LoadingBlock label="Carregando locais..." /></td></tr>
                ) : filteredLocations.length === 0 ? (
                  <tr><td colSpan={4}><EmptyBlock label="Nenhum local encontrado para os filtros." /></td></tr>
                ) : (
                  filteredLocations.map((location) => (
                    <tr key={location.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{location.name}</div>
                        {location.description && <div className="mt-1 text-xs text-slate-500">{location.description}</div>}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">{location.code}</td>
                      <td className="px-5 py-4 text-slate-700">{depositById[location.deposit_id]?.name || '-'}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          location.is_default ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {location.is_default ? 'Padrão' : 'Ativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Estoque por produto</h2>
              <p className="mt-1 text-sm text-slate-500">Pesquise por nome, SKU ou EAN e confira a distribuição por local.</p>
            </div>

            <div className="relative w-full lg:w-[420px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={productSearch}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setSelectedProduct(null);
                  setProductDistribution([]);
                  setProductError(null);
                }}
                placeholder="Buscar produto por nome, SKU ou EAN..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />

              {productResults.length > 0 && (
                <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                  {productResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => selectProduct(product)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <PackageSearch className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          SKU: {product.sku || '-'} {product.ean ? `· EAN: ${product.ean}` : ''} · Total: {product.stock_quantity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedProduct && (
          <div className="border-b border-slate-100 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                {selectedProduct.images?.[0] ? (
                  <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="h-full w-full object-cover" />
                ) : (
                  <PackageSearch className="h-7 w-7 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-900">{selectedProduct.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  SKU: {selectedProduct.sku || '-'} {selectedProduct.ean ? `· EAN: ${selectedProduct.ean}` : ''} · Estoque total: {selectedProduct.stock_quantity}
                </p>
              </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={openEntryModal}
                  disabled={deposits.length === 0 || locations.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} />
                  Entrada de estoque
                </button>
                <button
                  type="button"
                  onClick={openTransferModal}
                  disabled={deposits.length === 0 || locations.length < 2 || productDistribution.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <ArrowRightLeft size={16} />
                  Transferir estoque
                </button>
                <button
                  type="button"
                  onClick={openAdjustmentModal}
                  disabled={deposits.length === 0 || locations.length === 0}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Ajustar saldo
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Distribuição por local</h3>

          {productError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{productError}</div>
          )}

          {productLoading ? (
            <LoadingBlock label="Carregando distribuição..." />
          ) : !selectedProduct ? (
            <EmptyBlock label="Pesquise e selecione um produto para conferir a distribuição." />
          ) : productDistribution.length === 0 ? (
            <EmptyBlock label="Nenhuma distribuição por local encontrada para este produto." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Depósito</th>
                    <th className="px-5 py-3">Local</th>
                    <th className="px-5 py-3 text-right">Físico</th>
                    <th className="px-5 py-3 text-right">Reservado</th>
                    <th className="px-5 py-3 text-right">Disponível</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productDistribution.map((item) => {
                    const available = item.quantity - item.reserved_quantity;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-semibold text-slate-900">{item.deposit?.name || '-'}</td>
                        <td className="px-5 py-4 text-slate-700">{item.location?.name || '-'}</td>
                        <td className="px-5 py-4 text-right">{item.quantity}</td>
                        <td className="px-5 py-4 text-right">{item.reserved_quantity}</td>
                        <td className="px-5 py-4 text-right font-bold text-emerald-700">{available}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">Divergências</h2>
          <p className="mt-1 text-sm text-slate-500">Produtos cuja soma por local está diferente do estoque total atual.</p>
        </div>

        {loading ? (
          <LoadingBlock label="Carregando divergências..." />
        ) : divergences.length === 0 ? (
          <EmptyBlock label="Nenhuma divergência encontrada." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3 text-right">Total atual</th>
                  <th className="px-5 py-3 text-right">Soma por local</th>
                  <th className="px-5 py-3 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {divergences.map((item) => (
                  <tr key={item.product_id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">{item.product_name}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{item.sku || '-'}</td>
                    <td className="px-5 py-4 text-right">{item.product_stock_quantity}</td>
                    <td className="px-5 py-4 text-right">{item.location_stock_quantity}</td>
                    <td className="px-5 py-4 text-right font-bold text-amber-700">{item.difference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Histórico de movimentações</h2>
              <p className="mt-1 text-sm text-slate-500">Últimos registros auditáveis de estoque por depósito/local.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Carregando movimentações..." />
        ) : movements.length === 0 ? (
          <EmptyBlock label="Nenhuma movimentação registrada ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-right">Qtd.</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3">Referência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-600">{formatMovementDate(movement.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {formatMovementType(movement.movement_type)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{movement.product_id}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">{movement.quantity}</td>
                    <td className="px-5 py-4 text-slate-700">{movement.reason}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {movement.reference_type || '-'}{movement.reference_id ? ` / ${movement.reference_id}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {entryOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitEntry}
            className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Entrada de estoque</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={closeEntryModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {entryError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {entryError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Deposito</span>
                  <select
                    value={entryDepositId}
                    onChange={(event) => handleEntryDepositChange(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Selecione</option>
                    {deposits.map((deposit) => (
                      <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Local</span>
                  <select
                    value={entryLocationId}
                    onChange={(event) => setEntryLocationId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Selecione</option>
                    {entryLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Quantidade de entrada</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={entryQuantity}
                  onChange={(event) => setEntryQuantity(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Motivo da entrada</span>
                <input
                  type="text"
                  value={entryReason}
                  onChange={(event) => setEntryReason(event.target.value)}
                  placeholder="Ex.: compra, reposicao, retorno de conferencia"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Observacoes</span>
                <textarea
                  value={entryNotes}
                  onChange={(event) => setEntryNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEntryModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={entrySaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {entrySaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar entrada
              </button>
            </div>
          </form>
        </div>
      )}

      {transferOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitTransfer}
            className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Transferir estoque</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={closeTransferModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {transferError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {transferError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Origem</h3>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">DepÃ³sito</span>
                      <select
                        value={transferFromDepositId}
                        onChange={(event) => handleTransferFromDepositChange(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        required
                      >
                        <option value="">Selecione</option>
                        {deposits.map((deposit) => (
                          <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Local</span>
                      <select
                        value={transferFromLocationId}
                        onChange={(event) => setTransferFromLocationId(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        required
                      >
                        <option value="">Selecione</option>
                        {transferFromLocations.map((location) => (
                          <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                      </select>
                    </label>

                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Saldo disponÃ­vel na origem: <strong className="text-slate-900">{transferSourceAvailable}</strong>
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Destino</h3>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">DepÃ³sito</span>
                      <select
                        value={transferToDepositId}
                        onChange={(event) => handleTransferToDepositChange(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        required
                      >
                        <option value="">Selecione</option>
                        {deposits.map((deposit) => (
                          <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Local</span>
                      <select
                        value={transferToLocationId}
                        onChange={(event) => setTransferToLocationId(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        required
                      >
                        <option value="">Selecione</option>
                        {transferToLocations.map((location) => (
                          <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Quantidade para transferir</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Motivo da transferencia</span>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(event) => setTransferReason(event.target.value)}
                  placeholder="Ex.: reposicao de prateleira, envio para deposito, organizacao interna"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">ObservaÃ§Ãµes</span>
                <textarea
                  value={transferNotes}
                  onChange={(event) => setTransferNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeTransferModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={transferSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {transferSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar transferencia
              </button>
            </div>
          </form>
        </div>
      )}

      {adjustmentOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitAdjustment}
            className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ajustar saldo</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={closeAdjustmentModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {adjustmentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {adjustmentError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Depósito</span>
                  <select
                    value={adjustmentDepositId}
                    onChange={(event) => handleAdjustmentDepositChange(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Selecione</option>
                    {deposits.map((deposit) => (
                      <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Local</span>
                  <select
                    value={adjustmentLocationId}
                    onChange={(event) => handleAdjustmentLocationChange(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Selecione</option>
                    {adjustmentLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Quantidade física após ajuste</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={adjustmentQuantity}
                  onChange={(event) => setAdjustmentQuantity(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Motivo do ajuste</span>
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                  placeholder="Ex.: conferência, perda, avaria, erro de cadastro"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Observações</span>
                <textarea
                  value={adjustmentNotes}
                  onChange={(event) => setAdjustmentNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeAdjustmentModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={adjustmentSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {adjustmentSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar ajuste
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const MetricCard: React.FC<{ label: string; value: number; icon: React.ReactNode; tone?: 'default' | 'warning' | 'success' }> = ({
  label,
  value,
  icon,
  tone = 'default',
}) => {
  const toneClass = {
    default: 'bg-blue-100 text-blue-700',
    warning: 'bg-amber-100 text-amber-700',
    success: 'bg-emerald-100 text-emerald-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
      </div>
    </div>
  );
};

const LoadingBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

const EmptyBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-5 py-10 text-center text-sm text-slate-500">{label}</div>
);

function formatMovementType(type: StockLocationMovement['movement_type']): string {
  const labels: Record<StockLocationMovement['movement_type'], string> = {
    in: 'Entrada',
    out: 'Saída',
    adjustment: 'Ajuste',
    transfer: 'Transferência',
    reservation: 'Reserva',
    release_reservation: 'Liberação',
    sale: 'Venda',
    cancel: 'Cancelamento',
    sync: 'Sincronização',
  };

  return labels[type] || type;
}

function formatMovementDate(value: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
