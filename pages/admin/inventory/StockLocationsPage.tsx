import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, Boxes, Building2, Eye, FileDown, History, Loader2, MapPin, PackageSearch, Plus, RefreshCw, Search, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { stockLocationService } from '../../../services/stockLocationService';
import {
  LocationContentItem,
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
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositName, setDepositName] = useState('');
  const [depositCode, setDepositCode] = useState('');
  const [depositType, setDepositType] = useState<StockDeposit['type']>('warehouse');
  const [depositCep, setDepositCep] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [depositDefault, setDepositDefault] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDepositId, setLocationDepositId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [locationDefault, setLocationDefault] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
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
  const [quickTransferDepositId, setQuickTransferDepositId] = useState('');
  const [quickTransferLocationId, setQuickTransferLocationId] = useState('');

  // Location-contents modal: mostra o que tem dentro de um local específico.
  const [contentsOpen, setContentsOpen] = useState(false);
  const [contentsLocation, setContentsLocation] = useState<StockLocation | null>(null);
  const [contentsItems, setContentsItems] = useState<LocationContentItem[]>([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [contentsError, setContentsError] = useState<string | null>(null);

  // Batch transfer: carrinho de produtos pra mandar todos pra mesmo destino.
  type BatchItem = {
    product: StockLocationProductSearchResult;
    fromDepositId: string;
    fromLocationId: string;
    available: number;
    quantity: string;
    distribution: ProductStockLocation[];
  };
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchResults, setBatchResults] = useState<StockLocationProductSearchResult[]>([]);
  const [batchToDepositId, setBatchToDepositId] = useState('');
  const [batchToLocationId, setBatchToLocationId] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

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

  const openDepositModal = () => {
    setDepositName('');
    setDepositCode('');
    setDepositType('warehouse');
    setDepositCep('');
    setDepositAddress('');
    setDepositDefault(deposits.length === 0);
    setDepositError(null);
    setDepositOpen(true);
  };

  const closeDepositModal = () => {
    if (depositSaving) return;
    setDepositOpen(false);
  };

  const openLocationModal = (depositId = selectedDepositId) => {
    const fallbackDepositId = deposits.find((deposit) => deposit.is_default)?.id || deposits[0]?.id || '';

    setLocationDepositId(depositId === 'all' ? fallbackDepositId : depositId);
    setLocationName('');
    setLocationCode('');
    setLocationDescription('');
    setLocationDefault(false);
    setLocationError(null);
    setLocationOpen(true);
  };

  const closeLocationModal = () => {
    if (locationSaving) return;
    setLocationOpen(false);
  };

  const submitDeposit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!depositName.trim()) {
      setDepositError('Informe o nome do deposito.');
      return;
    }

    try {
      setDepositSaving(true);
      setDepositError(null);

      const createdDeposit = await stockLocationService.createDeposit({
        name: depositName,
        code: depositCode,
        type: depositType,
        cep: depositCep,
        address: depositAddress,
        is_default: depositDefault,
      });

      const [depositData, locationData] = await Promise.all([
        stockLocationService.listDeposits(),
        stockLocationService.listLocations(),
      ]);

      setDeposits(depositData);
      setLocations(locationData);
      setSelectedDepositId(createdDeposit.id);
      setDepositOpen(false);
    } catch (error) {
      setDepositError(error instanceof Error ? error.message : 'Nao foi possivel criar o deposito.');
    } finally {
      setDepositSaving(false);
    }
  };

  const submitLocation = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!locationDepositId) {
      setLocationError('Selecione o deposito.');
      return;
    }

    if (!locationName.trim()) {
      setLocationError('Informe o nome do local.');
      return;
    }

    try {
      setLocationSaving(true);
      setLocationError(null);

      await stockLocationService.createLocation({
        deposit_id: locationDepositId,
        name: locationName,
        code: locationCode,
        description: locationDescription,
        is_default: locationDefault,
      });

      const locationData = await stockLocationService.listLocations();
      setLocations(locationData);
      setSelectedDepositId(locationDepositId);
      setLocationOpen(false);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Nao foi possivel criar o local.');
    } finally {
      setLocationSaving(false);
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

      const distribution = await loadProductDistribution(product.id);
      setQuickTransferDestinationDefaults(distribution);
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

  const setQuickTransferDestinationDefaults = (distribution: ProductStockLocation[]) => {
    const sourceDistribution =
      distribution.find((item) => item.quantity - item.reserved_quantity > 0) ||
      distribution[0];
    const targetLocation =
      locations.find((location) => location.id !== sourceDistribution?.location_id) ||
      locations[0];

    setQuickTransferDepositId(targetLocation?.deposit_id || '');
    setQuickTransferLocationId(targetLocation?.id || '');
  };

  const handleQuickTransferDepositChange = (depositId: string) => {
    const firstLocation = locations.find((location) => location.deposit_id === depositId);

    setQuickTransferDepositId(depositId);
    setQuickTransferLocationId(firstLocation?.id || '');
  };

  const openTransferModal = (preferredTargetLocationId = '') => {
    const sourceDistribution =
      productDistribution.find((item) => item.location_id !== preferredTargetLocationId && item.quantity - item.reserved_quantity > 0) ||
      productDistribution.find((item) => item.quantity - item.reserved_quantity > 0) ||
      productDistribution[0];
    const sourceDepositId = sourceDistribution?.deposit_id || deposits.find((deposit) => deposit.is_default)?.id || deposits[0]?.id || '';
    const sourceLocation = locations.find((location) => location.id === sourceDistribution?.location_id) ||
      locations.find((location) => location.deposit_id === sourceDepositId);
    const preferredTargetLocation = locations.find((location) => location.id === preferredTargetLocationId && location.id !== sourceLocation?.id);
    const targetDepositId = preferredTargetLocation?.deposit_id || deposits.find((deposit) => deposit.id !== sourceDepositId)?.id || sourceDepositId;
    const targetLocation = preferredTargetLocation ||
      locations.find((location) => location.deposit_id === targetDepositId && location.id !== sourceLocation?.id) ||
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

  const openQuickTransferModal = () => {
    openTransferModal(quickTransferLocationId);
  };

  const closeTransferModal = () => {
    if (transferSaving) return;
    setTransferOpen(false);
  };

  const openLocationContents = async (location: StockLocation) => {
    setContentsLocation(location);
    setContentsOpen(true);
    setContentsLoading(true);
    setContentsError(null);
    setContentsItems([]);
    try {
      const items = await stockLocationService.getLocationContents(location.id);
      setContentsItems(items);
    } catch (err: any) {
      setContentsError(err?.message || 'Erro ao carregar conteúdo do local.');
    } finally {
      setContentsLoading(false);
    }
  };

  const closeLocationContents = () => {
    setContentsOpen(false);
    setContentsLocation(null);
    setContentsItems([]);
    setContentsError(null);
  };

  /**
   * Quebra o nome completo em "produto base" + "variação". Primeiro tenta detectar
   * padrões "Cor:X" / "Tamanho:Y" no próprio nome. Se não achar, recorre ao specs
   * do produto (color, size, ram, storage, voltage) — comum em produtos cujo nome
   * não traz o sufixo da variação.
   */
  const splitNameVariation = (fullName: string, specs?: Record<string, any> | null): { name: string; variation: string } => {
    const match = fullName.match(/^(.*?)\s+((?:Cor|Tamanho|Capacidade|RAM|Armazenamento|Memória|Voltagem)\s*:\s*.+)$/i);
    if (match) {
      return { name: match[1].trim(), variation: match[2].trim() };
    }
    if (specs && typeof specs === 'object') {
      const labels: Array<[string, string]> = [
        ['color', 'Cor'],
        ['size', 'Tamanho'],
        ['ram', 'RAM'],
        ['storage', 'Armazenamento'],
        ['voltage', 'Voltagem'],
        ['capacity', 'Capacidade'],
        ['memory', 'Memória'],
      ];
      const parts: string[] = [];
      for (const [key, label] of labels) {
        const v = specs[key];
        if (v && typeof v === 'string' && v.trim()) parts.push(`${label}:${v.trim()}`);
      }
      if (parts.length > 0) {
        return { name: fullName.trim(), variation: parts.join(' · ') };
      }
    }
    return { name: fullName.trim(), variation: '' };
  };

  const printContentsToPdf = () => {
    if (!contentsLocation || contentsItems.length === 0) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`Conteúdo do local: ${contentsLocation.name}`, 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    const depositName = depositById[contentsLocation.deposit_id]?.name || '-';
    doc.text(`Código: ${contentsLocation.code} · Depósito: ${depositName}`, 14, 24);
    const generatedAt = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em ${generatedAt}`, pageWidth - 14, 24, { align: 'right' });
    doc.setTextColor(0);

    // Tabela
    const rows = contentsItems.map((item) => {
      const { name, variation } = splitNameVariation(item.product_name, item.specs);
      return [
        String(item.quantity),
        name,
        variation || '-',
        item.sku || '-',
        item.ean || '-',
      ];
    });
    const totalQty = contentsItems.reduce((s, i) => s + i.quantity, 0);
    autoTable(doc, {
      startY: 32,
      head: [['Qtd', 'Produto', 'Variação', 'SKU', 'EAN']],
      body: rows,
      foot: [['', `Total (${contentsItems.length} produto${contentsItems.length === 1 ? '' : 's'})`, '', '', String(totalQty)]],
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { halign: 'right', cellWidth: 14 },
        1: { cellWidth: 75 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 32 },
      },
      didDrawPage: () => {
        const str = `Página ${doc.getCurrentPageInfo().pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(str, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      },
    });

    const slug = (contentsLocation.code || contentsLocation.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    doc.save(`conteudo-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /**
   * A partir do modal de conteúdo, dispara o fluxo de transferência já pré-preenchido:
   * busca o produto na seção "Estoque por produto" e abre o modal de transferência
   * com origem = local atual.
   */
  // ---------- Batch transfer helpers ----------
  useEffect(() => {
    const term = batchSearch.trim();
    if (term.length < 2) {
      setBatchResults([]);
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await stockLocationService.searchProducts(term);
        const existingIds = new Set(batchItems.map(i => i.product.id));
        if (!cancelled) {
          setBatchResults(results.filter(r => !existingIds.has(r.id)));
        }
      } catch {
        if (!cancelled) {
          setBatchResults([]);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [batchSearch, batchItems]);

  const handleBatchToDepositChange = (depositId: string) => {
    setBatchToDepositId(depositId);
    const first = locations.find((l) => l.deposit_id === depositId);
    setBatchToLocationId(first?.id || '');
  };

  const getDistributionAvailable = (distribution: ProductStockLocation) => {
    return Math.max(0, Number(distribution.quantity || 0) - Number(distribution.reserved_quantity || 0));
  };

  const getBatchTransferSources = (item: BatchItem, toLocationId = batchToLocationId) => {
    return item.distribution
      .filter((source) => {
        if (source.location_id === toLocationId) return false;
        return getDistributionAvailable(source) > 0;
      })
      .sort((a, b) => getDistributionAvailable(b) - getDistributionAvailable(a));
  };

  const getBatchTransferAvailable = (item: BatchItem, toLocationId = batchToLocationId) => {
    return getBatchTransferSources(item, toLocationId)
      .reduce((sum, source) => sum + getDistributionAvailable(source), 0);
  };

  /**
   * Enter no campo de busca do lote: ideal pra scanner de código de barras.
   * Resolve o produto na ordem: EAN exato → SKU exato → primeiro resultado.
   * Se a busca debounce ainda não rodou (scan rápido), força uma chamada síncrona.
   */
  const handleBatchSearchEnter = async () => {
    const term = batchSearch.trim();
    if (!term) return;
    setBatchError(null);
    const existingIds = new Set(batchItems.map(i => i.product.id));

    let candidate = batchResults.find(r => r.ean === term)
      || batchResults.find(r => r.sku === term)
      || batchResults[0];

    if (!candidate) {
      // Resultados ainda não chegaram (scan mais rápido que o debounce de 300ms)
      try {
        const fresh = (await stockLocationService.searchProducts(term))
          .filter(r => !existingIds.has(r.id));
        candidate = fresh.find(r => r.ean === term)
          || fresh.find(r => r.sku === term)
          || fresh[0];
      } catch {
        // ignora — vai cair no "não encontrado" abaixo
      }
    }

    if (!candidate) {
      setBatchError(`Produto não encontrado para "${term}".`);
      return;
    }

    await addBatchItem(candidate);
  };

  const addBatchItem = async (product: StockLocationProductSearchResult) => {
    setBatchError(null);
    try {
      const distribution = await stockLocationService.getProductStockDistribution(product.id);
      const best = [...distribution]
        .filter(d => d.quantity - d.reserved_quantity > 0)
        .sort((a, b) => (b.quantity - b.reserved_quantity) - (a.quantity - a.reserved_quantity))[0]
        || distribution[0];
      const available = distribution.reduce((sum, source) => sum + getDistributionAvailable(source), 0);
      const item: BatchItem = {
        product,
        fromDepositId: best?.deposit_id || '',
        fromLocationId: best?.location_id || '',
        available,
        quantity: String(available),
        distribution,
      };
      setBatchItems(prev => [...prev, item]);
      setBatchSearch('');
      setBatchResults(prev => prev.filter(r => r.id !== product.id));
    } catch (err: any) {
      setBatchError(err?.message || 'Erro ao adicionar produto ao lote.');
    }
  };

  const removeBatchItem = (productId: string) => {
    setBatchItems(prev => prev.filter(i => i.product.id !== productId));
  };

  const updateBatchItem = (productId: string, patch: Partial<BatchItem>) => {
    setBatchItems(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const next = { ...i, ...patch };
      if (patch.fromLocationId !== undefined || patch.distribution !== undefined) {
        next.available = getBatchTransferAvailable(next);
      }
      return next;
    }));
  };

  const submitBatchTransfer = async () => {
    setBatchError(null);
    if (batchItems.length === 0) {
      setBatchError('Adicione pelo menos um produto à lista.');
      return;
    }
    if (!batchToDepositId || !batchToLocationId) {
      setBatchError('Selecione o depósito e o local de destino.');
      return;
    }
    const invalidOverAvailable = batchItems.find((item) => {
      const qty = Number(item.quantity);
      const available = getBatchTransferAvailable(item, batchToLocationId);
      return Number.isFinite(qty) && qty > available;
    });
    if (invalidOverAvailable) {
      setBatchError(`Quantidade maior que o saldo transferível para ${invalidOverAvailable.product.sku || invalidOverAvailable.product.name}.`);
      return;
    }

    const transferRequests = batchItems.flatMap((item) => {
      let remainingQuantity = Number(item.quantity);
      if (!Number.isFinite(remainingQuantity) || remainingQuantity <= 0) return [];

      return getBatchTransferSources(item, batchToLocationId).flatMap((source) => {
        if (remainingQuantity <= 0) return [];
        const sourceAvailable = getDistributionAvailable(source);
        const quantity = Math.min(remainingQuantity, sourceAvailable);
        remainingQuantity -= quantity;
        return [{
          item,
          source,
          quantity,
        }];
      });
    });

    if (transferRequests.length === 0) {
      setBatchError('Nenhum item tem quantidade/origem válida para transferir.');
      return;
    }

    setBatchSubmitting(true);
    setBatchProgress({ done: 0, total: transferRequests.length });
    const failed: { sku: string | null; error: string }[] = [];
    for (let i = 0; i < transferRequests.length; i++) {
      const request = transferRequests[i];
      try {
        await stockLocationService.transferStockLocation({
          product_id: request.item.product.id,
          from_deposit_id: request.source.deposit_id,
          from_location_id: request.source.location_id,
          to_deposit_id: batchToDepositId,
          to_location_id: batchToLocationId,
          quantity: request.quantity,
          reason: batchReason.trim() || 'Transferência em lote',
          notes: batchNotes.trim() || undefined,
        });
      } catch (err: any) {
        failed.push({ sku: request.item.product.sku || null, error: err?.message || 'falha' });
      }
      setBatchProgress({ done: i + 1, total: transferRequests.length });
    }
    setBatchSubmitting(false);

    const okCount = transferRequests.length - failed.length;
    if (failed.length > 0) {
      setBatchError(`${okCount} transferência(s) ok, ${failed.length} falharam: ${failed.slice(0, 3).map(f => f.sku || '?').join(', ')}${failed.length > 3 ? '…' : ''}`);
    } else {
      // Sucesso total: limpa lista e fecha
      setBatchItems([]);
      setBatchReason('');
      setBatchNotes('');
      setBatchProgress(null);
      // Recarrega divergências/movimentos
      loadData();
    }
  };

  const handleTransferFromContents = async (item: LocationContentItem) => {
    closeLocationContents();
    // Reaproveita o fluxo existente de seleção de produto
    try {
      const results = await stockLocationService.searchProducts(item.sku || item.product_name);
      const productMatch = results.find((p) => p.id === item.product_id) || results[0];
      if (productMatch) {
        await selectProduct(productMatch);
        // Aguarda o productDistribution carregar antes de abrir o modal — agendamos pra próximo tick
        window.setTimeout(() => {
          setTransferFromDepositId(item.deposit_id || '');
          setTransferFromLocationId(item.location_id || '');
          setTransferQuantity('1');
          setTransferReason('');
          setTransferNotes('');
          setTransferError(null);
          setTransferOpen(true);
        }, 300);
      }
    } catch (err: any) {
      console.error('[StockLocationsPage] transfer from contents', err);
    }
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
  const quickTransferLocations = locations.filter((location) => location.deposit_id === quickTransferDepositId);
  const transferSourceDistribution = getDistributionByLocation(transferFromLocationId);
  const transferSourceAvailable = transferSourceDistribution
    ? transferSourceDistribution.quantity - transferSourceDistribution.reserved_quantity
    : 0;

  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProduct) return;

    const quantity = Number(transferQuantity);

    if (!transferFromDepositId || !transferFromLocationId || !transferToDepositId || !transferToLocationId) {
      setTransferError('Selecione origem e destino da transferência.');
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
      setTransferError('A quantidade transferida não pode exceder a quantidade disponível na origem.');
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
        reason: transferReason.trim() || 'Transferência interna',
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
              Entradas e ajustes usam motivo obrigatório. Transferências podem usar motivo padrão e seguem com histórico auditável por local.
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Depósitos</h2>
                <p className="mt-1 text-sm text-slate-500">Pontos físicos de armazenamento cadastrados pela migration.</p>
              </div>
              <button
                type="button"
                onClick={openDepositModal}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Novo deposito
              </button>
            </div>
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
                <button
                  type="button"
                  onClick={() => openLocationModal()}
                  disabled={deposits.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} />
                  Novo local
                </button>
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
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5}><LoadingBlock label="Carregando locais..." /></td></tr>
                ) : filteredLocations.length === 0 ? (
                  <tr><td colSpan={5}><EmptyBlock label="Nenhum local encontrado para os filtros." /></td></tr>
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
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openLocationContents(location)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          title="Ver produtos armazenados neste local"
                        >
                          <Eye size={14} />
                          Ver conteúdo
                        </button>
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
            <div className="relative w-full lg:flex-1 lg:max-w-2xl">
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
                      className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <PackageSearch className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{product.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          SKU: {product.sku || '-'} {product.ean ? `· EAN: ${product.ean}` : ''} · Total: {product.stock_quantity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:max-w-md lg:text-right">
              <h2 className="text-lg font-bold text-slate-900">Estoque por produto</h2>
              <p className="mt-1 text-sm text-slate-500">Pesquise por nome, SKU ou EAN e confira a distribuição por local.</p>
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
                  onClick={() => openTransferModal()}
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

            <div className="mt-4 rounded-lg border border-blue-100 bg-white p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Destino rápido</p>
                  <p className="mt-1 text-xs text-slate-500">Escolha para onde esse produto deve ir e abra a transferência já preenchida.</p>
                </div>
                <label className="block min-w-[190px]">
                  <span className="text-xs font-semibold text-slate-600">Depósito</span>
                  <select
                    value={quickTransferDepositId}
                    onChange={(event) => handleQuickTransferDepositChange(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Selecione</option>
                    {deposits.map((deposit) => (
                      <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-[190px]">
                  <span className="text-xs font-semibold text-slate-600">Local</span>
                  <select
                    value={quickTransferLocationId}
                    onChange={(event) => setQuickTransferLocationId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Selecione</option>
                    {quickTransferLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={openQuickTransferModal}
                  disabled={!quickTransferLocationId || productDistribution.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <ArrowRightLeft size={16} />
                  Transferir para este local
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
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue-600" />
            Transferência em lote
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecione vários produtos por nome/SKU/EAN e envie todos pro mesmo destino numa ação só.
          </p>
        </div>

        <div className="space-y-5 p-5">
          {/* Busca pra adicionar produto */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={batchSearch}
              onChange={(event) => setBatchSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleBatchSearchEnter();
                }
              }}
              placeholder="Bipar EAN, digitar SKU ou nome — Enter adiciona à lista"
              autoFocus
              className="h-10 w-full rounded-lg border-2 border-blue-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {batchResults.length > 0 && (
              <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                {batchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addBatchItem(product)}
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <PackageSearch className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{product.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        SKU: {product.sku || '-'} {product.ean ? `· EAN: ${product.ean}` : ''} · Estoque total: {product.stock_quantity}
                      </p>
                    </div>
                    <Plus size={16} className="text-blue-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabela de itens do lote */}
          {batchItems.length === 0 ? (
            <EmptyBlock label="Nenhum produto na lista. Pesquise acima pra adicionar." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Produto</th>
                    <th className="px-3 py-3">Origem</th>
                    <th className="px-3 py-3 text-right">Disponível</th>
                    <th className="px-3 py-3 text-center">Quantidade</th>
                    <th className="px-3 py-3 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchItems.map((item) => {
                    const originLocations = getBatchTransferSources(item);
                    const transferAvailable = getBatchTransferAvailable(item);
                    return (
                      <tr key={item.product.id}>
                        <td className="px-3 py-3">
                          <p className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{item.product.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.product.sku || '-'}
                            {item.product.ean ? ` · EAN: ${item.product.ean}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs text-slate-600">
                            <p className="font-semibold text-slate-800">
                              {originLocations.length > 1 ? 'Todas as origens com saldo' : originLocations[0] ? `${originLocations[0].deposit?.name || '-'} / ${originLocations[0].location?.name || '-'}` : 'Sem saldo'}
                            </p>
                            {originLocations.length > 1 && (
                              <p className="mt-0.5 text-slate-500">{originLocations.length} locais</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-emerald-700">{transferAvailable}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateBatchItem(item.product.id, { quantity: e.target.value })}
                              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-center"
                            />
                            <button
                              type="button"
                              onClick={() => updateBatchItem(item.product.id, { quantity: '1' })}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              1
                            </button>
                            <button
                              type="button"
                              onClick={() => transferAvailable > 0 && updateBatchItem(item.product.id, { quantity: String(transferAvailable) })}
                              disabled={transferAvailable <= 0}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              Tudo
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeBatchItem(item.product.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Remover do lote"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total ({batchItems.length} produto{batchItems.length === 1 ? '' : 's'})
                    </td>
                    <td className="px-3 py-2 text-center text-sm font-bold text-slate-900">
                      {batchItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Destino comum */}
          {batchItems.length > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Depósito de destino</span>
                  <select
                    value={batchToDepositId}
                    onChange={(e) => handleBatchToDepositChange(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Selecione</option>
                    {deposits.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Local de destino</span>
                  <select
                    value={batchToLocationId}
                    onChange={(e) => setBatchToLocationId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Selecione</option>
                    {locations.filter(l => !batchToDepositId || l.deposit_id === batchToDepositId).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Motivo (opcional)</span>
                  <input
                    type="text"
                    value={batchReason}
                    onChange={(e) => setBatchReason(e.target.value)}
                    placeholder="Ex.: organização caixa 13"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Observações (opcional)</span>
                  <input
                    type="text"
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                </label>
              </div>

              {batchError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{batchError}</div>
              )}

              {batchProgress && batchSubmitting && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-sm text-blue-700">
                  Transferindo... {batchProgress.done}/{batchProgress.total}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={submitBatchTransfer}
                  disabled={batchSubmitting || !batchToLocationId || batchItems.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {batchSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <ArrowRightLeft size={16} />
                  Transferir todos ({batchItems.length})
                </button>
              </div>
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

      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitDeposit}
            className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Novo deposito</h2>
                <p className="mt-1 text-sm text-slate-500">Cadastre uma loja, galpao ou ponto fisico de estoque.</p>
              </div>
              <button
                type="button"
                onClick={closeDepositModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-5">
              {depositError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {depositError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nome</span>
                  <input
                    type="text"
                    value={depositName}
                    onChange={(event) => setDepositName(event.target.value)}
                    placeholder="Ex.: Loja Centro"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Codigo</span>
                  <input
                    type="text"
                    value={depositCode}
                    onChange={(event) => setDepositCode(event.target.value)}
                    placeholder="Automatico se vazio"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Tipo</span>
                <select
                  value={depositType}
                  onChange={(event) => setDepositType(event.target.value as StockDeposit['type'])}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="store">Loja</option>
                  <option value="warehouse">Deposito</option>
                  <option value="support">Suporte</option>
                  <option value="transit">Transito</option>
                  <option value="other">Outro</option>
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">CEP</span>
                  <input
                    type="text"
                    value={depositCep}
                    onChange={(event) => setDepositCep(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Endereco</span>
                  <input
                    type="text"
                    value={depositAddress}
                    onChange={(event) => setDepositAddress(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={depositDefault}
                  onChange={(event) => setDepositDefault(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Usar como deposito padrao
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDepositModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={depositSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {depositSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar deposito
              </button>
            </div>
          </form>
        </div>
      )}

      {locationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitLocation}
            className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Novo local</h2>
                <p className="mt-1 text-sm text-slate-500">Cadastre prateleira, balcao, caixa ou posicao interna.</p>
              </div>
              <button
                type="button"
                onClick={closeLocationModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-5">
              {locationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {locationError}
                </div>
              )}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Deposito</span>
                <select
                  value={locationDepositId}
                  onChange={(event) => setLocationDepositId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                >
                  <option value="">Selecione</option>
                  {deposits.map((deposit) => (
                    <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Nome</span>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    placeholder="Ex.: Prateleira 1"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Codigo</span>
                  <input
                    type="text"
                    value={locationCode}
                    onChange={(event) => setLocationCode(event.target.value)}
                    placeholder="Automatico se vazio"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Descricao</span>
                <textarea
                  value={locationDescription}
                  onChange={(event) => setLocationDescription(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={locationDefault}
                  onChange={(event) => setLocationDefault(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Usar como local padrao deste deposito
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLocationModal}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={locationSaving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {locationSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar local
              </button>
            </div>
          </form>
        </div>
      )}

      {entryOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitEntry}
            className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
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

            <div className="flex-1 overflow-y-auto space-y-4 p-5">
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
                <span className="text-sm font-semibold text-slate-700">Observações</span>
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
            className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
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

            <div className="flex-1 overflow-y-auto space-y-5 p-5">
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
                      <span className="text-sm font-semibold text-slate-700">Depósito</span>
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
                      Saldo disponível na origem: <strong className="text-slate-900">{transferSourceAvailable}</strong>
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Destino</h3>
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Depósito</span>
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
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={transferQuantity}
                    onChange={(event) => setTransferQuantity(event.target.value)}
                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setTransferQuantity('1')}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    1 item
                  </button>
                  <button
                    type="button"
                    onClick={() => transferSourceAvailable > 0 && setTransferQuantity(String(transferSourceAvailable))}
                    disabled={transferSourceAvailable <= 0}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Todo o estoque ({transferSourceAvailable})
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Motivo da transferência <span className="font-normal text-slate-400">(opcional)</span></span>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(event) => setTransferReason(event.target.value)}
                  placeholder="Ex.: reposição de prateleira, envio para depósito, organização interna"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Observações</span>
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
                Salvar transferência
              </button>
            </div>
          </form>
        </div>
      )}

      {adjustmentOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitAdjustment}
            className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
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

            <div className="flex-1 overflow-y-auto space-y-4 p-5">
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

      {/* Modal: Conteúdo do local */}
      {contentsOpen && contentsLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={closeLocationContents}>
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Eye size={18} className="text-blue-600" />
                  Conteúdo de {contentsLocation.name}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {contentsLocation.code} · {depositById[contentsLocation.deposit_id]?.name || '-'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printContentsToPdf}
                  disabled={contentsItems.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Gerar PDF com a lista de produtos deste local"
                >
                  <FileDown size={14} />
                  Imprimir PDF
                </button>
                <button
                  type="button"
                  onClick={closeLocationContents}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {contentsError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{contentsError}</div>
              )}

              {contentsLoading ? (
                <LoadingBlock label="Carregando produtos do local..." />
              ) : contentsItems.length === 0 ? (
                <EmptyBlock label="Nenhum produto com saldo neste local." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Produto</th>
                        <th className="px-3 py-3">SKU</th>
                        <th className="px-3 py-3 text-right">Físico</th>
                        <th className="px-3 py-3 text-right">Reservado</th>
                        <th className="px-3 py-3 text-right">Disponível</th>
                        <th className="px-3 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contentsItems.map((item) => (
                        <tr key={item.product_id} className="hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                {item.product_image ? (
                                  <img src={item.product_image} alt={item.product_name} className="h-full w-full object-cover" />
                                ) : (
                                  <PackageSearch className="m-auto h-5 w-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 whitespace-normal break-words">{item.product_name}</p>
                                {item.ean && <p className="text-xs text-slate-500">EAN: {item.ean}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">{item.sku || '-'}</td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-900">{item.quantity}</td>
                          <td className="px-3 py-3 text-right text-slate-600">{item.reserved_quantity}</td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-700">{item.available}</td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleTransferFromContents(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title="Transferir este produto a partir deste local"
                            >
                              <ArrowRightLeft size={12} />
                              Transferir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50">
                      <tr>
                        <td colSpan={2} className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Total ({contentsItems.length} produto{contentsItems.length === 1 ? '' : 's'})
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-slate-900">
                          {contentsItems.reduce((sum, it) => sum + it.quantity, 0)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-slate-600">
                          {contentsItems.reduce((sum, it) => sum + it.reserved_quantity, 0)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">
                          {contentsItems.reduce((sum, it) => sum + it.available, 0)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
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
