import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, Boxes, Building2, ChevronDown, ChevronRight, Copy, Eye, FileDown, History, Loader2, MapPin, Monitor, PackageSearch, Pencil, Plus, Printer, QrCode, RefreshCw, RotateCcw, Search, Smartphone, Trash2, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { stockLocationService } from '../../../services/stockLocationService';
import {
  LocationContentItem,
  ProductStockLocation,
  StockDeposit,
  StockLocation,
  StockLocationDivergence,
  StockLocationMovement,
  StockLocationProductSearchResult,
  StockPathDeactivationCheck,
  StockPathDeactivationItem,
  StockPathDeactivationTarget,
} from '../../../types/stock-location';

const BATCH_TRANSFER_STORAGE_KEY = 'mdv-stock-location-batch-transfer-v1';

type BatchReadError = {
  id: string;
  term: string;
  message: string;
  createdAt: string;
  count: number;
};

export function StockLocationsPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search')?.trim() || '';
  const [deposits, setDeposits] = useState<StockDeposit[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [divergences, setDivergences] = useState<StockLocationDivergence[]>([]);
  const [movements, setMovements] = useState<StockLocationMovement[]>([]);
  const [movementPeriodDays, setMovementPeriodDays] = useState('7');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [depositName, setDepositName] = useState('');
  const [depositCode, setDepositCode] = useState('');
  const [depositType, setDepositType] = useState<StockDeposit['type']>('warehouse');
  const [depositCep, setDepositCep] = useState('');
  const [depositAddress, setDepositAddress] = useState('');
  const [depositDefault, setDepositDefault] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationDepositId, setLocationDepositId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [locationDefault, setLocationDefault] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDepositId, setSelectedDepositId] = useState<string>('all');
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const [divergencesExpanded, setDivergencesExpanded] = useState(false);
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
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  const [deactivationTarget, setDeactivationTarget] = useState<{
    type: StockPathDeactivationTarget;
    id: string;
    name: string;
    depositId?: string;
  } | null>(null);
  const [deactivationCheck, setDeactivationCheck] = useState<StockPathDeactivationCheck | null>(null);
  const [deactivationSelectedProductIds, setDeactivationSelectedProductIds] = useState<string[]>([]);
  const [deactivationToDepositId, setDeactivationToDepositId] = useState('');
  const [deactivationToLocationId, setDeactivationToLocationId] = useState('');
  const [deactivationLoading, setDeactivationLoading] = useState(false);
  const [deactivationSaving, setDeactivationSaving] = useState(false);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

  // Location-contents modal: mostra o que tem dentro de um local específico.
  const [contentsOpen, setContentsOpen] = useState(false);
  const [contentsLocation, setContentsLocation] = useState<StockLocation | null>(null);
  const [contentsItems, setContentsItems] = useState<LocationContentItem[]>([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [contentsError, setContentsError] = useState<string | null>(null);
  const [contentsActionProductId, setContentsActionProductId] = useState<string | null>(null);
  const [qrLocation, setQrLocation] = useState<StockLocation | null>(null);

  // Batch transfer: carrinho de produtos pra mandar todos pra mesmo destino.
  type BatchItem = {
    product: StockLocationProductSearchResult;
    fromDepositId: string;
    fromLocationId: string;
    available: number;
    quantity: string;
    distribution: ProductStockLocation[];
  };
  type BatchDraftItem = {
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
  const [batchToLocationSearch, setBatchToLocationSearch] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchReadErrors, setBatchReadErrors] = useState<BatchReadError[]>([]);
  const [batchDraftLoaded, setBatchDraftLoaded] = useState(false);
  const batchSearchInputRef = useRef<HTMLInputElement | null>(null);
  const batchDraftQuotaWarningShownRef = useRef(false);

  const serializeBatchDraftItem = (item: BatchItem): BatchDraftItem => ({
    product: {
      id: item.product.id,
      name: item.product.name,
      sku: item.product.sku || null,
      ean: item.product.ean || null,
      stock_quantity: item.product.stock_quantity,
      images: item.product.images?.slice(0, 1) || null,
    },
    fromDepositId: item.fromDepositId,
    fromLocationId: item.fromLocationId,
    available: item.available,
    quantity: item.quantity,
    distribution: item.distribution.map((source) => ({
      id: source.id,
      company_id: source.company_id,
      product_id: source.product_id,
      deposit_id: source.deposit_id,
      location_id: source.location_id,
      quantity: source.quantity,
      reserved_quantity: source.reserved_quantity,
      created_at: source.created_at,
      updated_at: source.updated_at,
      deposit: source.deposit ? {
        id: source.deposit.id,
        company_id: source.deposit.company_id,
        name: source.deposit.name,
        code: source.deposit.code,
        type: source.deposit.type,
        cep: source.deposit.cep || null,
        address: source.deposit.address || null,
        is_default: Boolean(source.deposit.is_default),
        is_active: source.deposit.is_active !== false,
        created_at: source.deposit.created_at,
        updated_at: source.deposit.updated_at,
      } : null,
      location: source.location ? {
        id: source.location.id,
        company_id: source.location.company_id,
        deposit_id: source.location.deposit_id,
        name: source.location.name,
        code: source.location.code,
        description: source.location.description || null,
        is_default: Boolean(source.location.is_default),
        is_active: source.location.is_active !== false,
        created_at: source.location.created_at,
        updated_at: source.location.updated_at,
      } : null,
    })),
  });

  const hydrateBatchDraftItem = (item: BatchDraftItem): BatchItem | null => {
    if (!item?.product?.id || !item.product.name) return null;

    const distribution = Array.isArray(item.distribution) ? item.distribution.map((source) => ({
      id: source.id || `${item.product.id}-${source.deposit_id || ''}-${source.location_id || ''}`,
      company_id: source.company_id || '',
      product_id: source.product_id || item.product.id,
      deposit_id: source.deposit_id || '',
      location_id: source.location_id || '',
      quantity: Number(source.quantity || 0),
      reserved_quantity: Number(source.reserved_quantity || 0),
      created_at: source.created_at || '',
      updated_at: source.updated_at || '',
      deposit: source.deposit || null,
      location: source.location || null,
    })) : [];

    return {
      product: {
        id: item.product.id,
        name: item.product.name,
        sku: item.product.sku || null,
        ean: item.product.ean || null,
        stock_quantity: Number(item.product.stock_quantity || 0),
        images: item.product.images?.slice(0, 1) || null,
      },
      fromDepositId: item.fromDepositId || '',
      fromLocationId: item.fromLocationId || '',
      available: Number(item.available || 0),
      quantity: item.quantity || '1',
      distribution,
    };
  };

  const formatLocationName = (value: string) =>
    value.toLocaleLowerCase('pt-BR').replace(/(^|[\s\-/])(\p{L})/gu, (_, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase('pt-BR')}`
    );

  const getLocationDisplayName = (location?: Pick<StockLocation, 'name' | 'code'> | null) => {
    const name = (location?.name || '').trim();
    const code = (location?.code || '').trim();
    if (!name) return code || '-';
    if (!code) return name;

    const normalizedName = name.toLocaleLowerCase('pt-BR');
    const normalizedCode = code.toLocaleLowerCase('pt-BR');
    const compactName = normalizedName.replace(/[^a-z0-9]+/g, '');
    const compactCode = normalizedCode.replace(/[^a-z0-9]+/g, '');
    if (compactCode && compactName.includes(compactCode)) return name;

    return `${name} ${code}`;
  };

  const normalizeReadTerm = (value?: string | null) => (value || '').trim().toLocaleLowerCase('pt-BR');

  const focusBatchSearchInput = () => {
    window.setTimeout(() => {
      batchSearchInputRef.current?.focus();
    }, 0);
  };

  const playBatchErrorSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = 220;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.onended = () => context.close();
    } catch {
      // Aviso sonoro é apenas apoio operacional; a lista de erros continua sendo o registro principal.
    }
  };

  const addBatchReadError = (term: string, message: string) => {
    const normalizedTerm = normalizeReadTerm(term);
    if (!normalizedTerm) return;
    setBatchReadErrors(prev => {
      const existing = prev.find(error => normalizeReadTerm(error.term) === normalizedTerm);
      if (existing) {
        return [
          { ...existing, message, createdAt: new Date().toISOString(), count: existing.count + 1 },
          ...prev.filter(error => error.id !== existing.id),
        ];
      }
      return [{
        id: `${Date.now()}-${normalizedTerm}`,
        term,
        message,
        createdAt: new Date().toISOString(),
        count: 1,
      }, ...prev];
    });
  };

  const clearBatchReadErrorForProduct = (product: StockLocationProductSearchResult, scannedTerm = '') => {
    const matches = new Set([scannedTerm, product.ean, product.sku].map(normalizeReadTerm).filter(Boolean));
    if (matches.size === 0) return;
    setBatchReadErrors(prev => prev.filter(error => !matches.has(normalizeReadTerm(error.term))));
  };

  const getBatchProductIdentityKeys = (product: Pick<StockLocationProductSearchResult, 'id' | 'ean' | 'sku'>) =>
    [product.ean, product.sku, product.id].map(normalizeReadTerm).filter(Boolean);

  const hasBatchProductIdentityOverlap = (
    left: Pick<StockLocationProductSearchResult, 'id' | 'ean' | 'sku'>,
    right: Pick<StockLocationProductSearchResult, 'id' | 'ean' | 'sku'>
  ) => {
    const leftKeys = new Set(getBatchProductIdentityKeys(left));
    return getBatchProductIdentityKeys(right).some(key => leftKeys.has(key));
  };

  const findBatchItemByProduct = (product: StockLocationProductSearchResult) =>
    batchItems.find(item => hasBatchProductIdentityOverlap(item.product, product));

  const isBatchBarcodeTerm = (term: string) => /^\d{8,}$/.test(term.trim());

  const resolveBatchSearchCandidate = (term: string, results: StockLocationProductSearchResult[]) =>
    results.find(result => normalizeReadTerm(result.ean) === normalizeReadTerm(term))
    || results.find(result => normalizeReadTerm(result.sku) === normalizeReadTerm(term))
    || (!isBatchBarcodeTerm(term) ? results[0] : undefined);

  useEffect(() => {
    loadData();
  }, [movementPeriodDays]);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(BATCH_TRANSFER_STORAGE_KEY);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (Array.isArray(draft?.items)) {
          setBatchItems(draft.items.map(hydrateBatchDraftItem).filter((item): item is BatchItem => Boolean(item)));
        }
        if (Array.isArray(draft?.readErrors)) {
          setBatchReadErrors(draft.readErrors);
        }
        if (typeof draft?.toDepositId === 'string') setBatchToDepositId(draft.toDepositId);
        if (typeof draft?.toLocationId === 'string') setBatchToLocationId(draft.toLocationId);
        if (typeof draft?.toLocationSearch === 'string') setBatchToLocationSearch(draft.toLocationSearch);
        if (typeof draft?.reason === 'string') setBatchReason(draft.reason);
        if (typeof draft?.notes === 'string') setBatchNotes(draft.notes);
      }
    } catch {
      window.localStorage.removeItem(BATCH_TRANSFER_STORAGE_KEY);
    } finally {
      setBatchDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!batchDraftLoaded) return;

    const hasDraft = batchItems.length > 0 || batchReadErrors.length > 0 || batchToDepositId || batchToLocationId || batchToLocationSearch || batchReason || batchNotes;
    if (!hasDraft) {
      window.localStorage.removeItem(BATCH_TRANSFER_STORAGE_KEY);
      return;
    }

    const batchDraft = {
      items: batchItems.map(serializeBatchDraftItem),
      readErrors: batchReadErrors,
      toDepositId: batchToDepositId,
      toLocationId: batchToLocationId,
      toLocationSearch: batchToLocationSearch,
      reason: batchReason,
      notes: batchNotes,
    };

    try {
      window.localStorage.setItem(BATCH_TRANSFER_STORAGE_KEY, JSON.stringify(batchDraft));
      batchDraftQuotaWarningShownRef.current = false;
    } catch {
      if (!batchDraftQuotaWarningShownRef.current) {
        toast.warning('A lista ficou grande demais para manter salva neste navegador. Continue a transferencia sem recarregar a pagina.');
        batchDraftQuotaWarningShownRef.current = true;
      }
    }
  }, [batchDraftLoaded, batchItems, batchReadErrors, batchToDepositId, batchToLocationId, batchToLocationSearch, batchReason, batchNotes]);

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
        stockLocationService.listMovements(getMovementQueryFilters()),
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

  const getMovementQueryFilters = () => ({
    limit: 80,
    createdAfter: getMovementCreatedAfter(movementPeriodDays),
  });

  const copyMovementLog = async () => {
    const text = buildMovementLogText(movements);
    if (!text.trim()) {
      toast.error('Nenhum log para copiar neste periodo.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Log copiado.');
    } catch (error) {
      toast.error('Nao foi possivel copiar o log.');
    }
  };

  const downloadMovementLogTxt = () => {
    const text = buildMovementLogText(movements);
    if (!text.trim()) {
      toast.error('Nenhum log para baixar neste periodo.');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-location-log-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openDepositModal = () => {
    setEditingDepositId(null);
    setDepositName('');
    setDepositCode('');
    setDepositType('warehouse');
    setDepositCep('');
    setDepositAddress('');
    setDepositDefault(deposits.length === 0);
    setDepositError(null);
    setDepositOpen(true);
  };

  const openEditDepositModal = (deposit: StockDeposit) => {
    setEditingDepositId(deposit.id);
    setDepositName(deposit.name || '');
    setDepositCode('');
    setDepositType(deposit.type || 'warehouse');
    setDepositCep(deposit.cep || '');
    setDepositAddress(deposit.address || '');
    setDepositDefault(Boolean(deposit.is_default));
    setDepositError(null);
    setDepositOpen(true);
  };

  const closeDepositModal = () => {
    if (depositSaving) return;
    setDepositOpen(false);
  };

  const openLocationModal = (depositId = selectedDepositId) => {
    const fallbackDepositId = deposits.find((deposit) => deposit.is_default)?.id || deposits[0]?.id || '';

    setEditingLocationId(null);
    setLocationDepositId(depositId === 'all' ? fallbackDepositId : depositId);
    setLocationName('');
    setLocationCode('');
    setLocationDescription('');
    setLocationDefault(false);
    setLocationError(null);
    setLocationOpen(true);
  };

  const openEditLocationModal = (location: StockLocation) => {
    setEditingLocationId(location.id);
    setLocationDepositId(location.deposit_id || '');
    setLocationName(location.name || '');
    setLocationCode('');
    setLocationDescription(location.description || '');
    setLocationDefault(Boolean(location.is_default));
    setLocationError(null);
    setLocationOpen(true);
  };

  const closeLocationModal = () => {
    if (locationSaving) return;
    setLocationOpen(false);
  };

  const pickDeactivationDestination = (excludeDepositId?: string, excludeLocationId?: string) => {
    const targetLocation =
      locations.find((location) => location.is_active && location.id !== excludeLocationId && location.deposit_id !== excludeDepositId) ||
      locations.find((location) => location.is_active && location.id !== excludeLocationId);

    return {
      depositId: targetLocation?.deposit_id || '',
      locationId: targetLocation?.id || '',
    };
  };

  const loadDeactivationCheck = async (target = deactivationTarget) => {
    if (!target) return;

    setDeactivationLoading(true);
    setDeactivationError(null);
    try {
      const check = target.type === 'deposit'
        ? await stockLocationService.getDepositDeactivationCheck(target.id)
        : await stockLocationService.getLocationDeactivationCheck(target.id);

      setDeactivationCheck(check);
      setDeactivationSelectedProductIds(check.pending_items.map((item) => item.product_id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel carregar os produtos pendentes.';
      setDeactivationError(message);
      toast.error(message);
    } finally {
      setDeactivationLoading(false);
    }
  };

  const openDepositDeactivation = async (deposit: StockDeposit) => {
    const target = { type: 'deposit' as const, id: deposit.id, name: deposit.name, depositId: deposit.id };
    const destination = pickDeactivationDestination(deposit.id);

    setDeactivationTarget(target);
    setDeactivationCheck(null);
    setDeactivationSelectedProductIds([]);
    setDeactivationToDepositId(destination.depositId);
    setDeactivationToLocationId(destination.locationId);
    setDeactivationError(null);
    setDeactivationOpen(true);
    await loadDeactivationCheck(target);
  };

  const openLocationDeactivation = async (location: StockLocation) => {
    const target = { type: 'location' as const, id: location.id, name: location.name, depositId: location.deposit_id };
    const destination = pickDeactivationDestination(undefined, location.id);

    setDeactivationTarget(target);
    setDeactivationCheck(null);
    setDeactivationSelectedProductIds([]);
    setDeactivationToDepositId(destination.depositId);
    setDeactivationToLocationId(destination.locationId);
    setDeactivationError(null);
    setDeactivationOpen(true);
    await loadDeactivationCheck(target);
  };

  const closeDeactivationModal = () => {
    if (deactivationSaving) return;
    setDeactivationOpen(false);
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

      const savedDeposit = editingDepositId
        ? await stockLocationService.updateDeposit(editingDepositId, {
          name: depositName,
          code: depositCode,
          type: depositType,
          cep: depositCep,
          address: depositAddress,
          is_default: depositDefault,
        })
        : await stockLocationService.createDeposit({
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
      setSelectedDepositId(savedDeposit.id);
      setDepositOpen(false);
    } catch (error) {
      setDepositError(error instanceof Error ? error.message : 'Nao foi possivel salvar o deposito.');
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

      if (editingLocationId) {
        await stockLocationService.updateLocation(editingLocationId, {
          deposit_id: locationDepositId,
          name: locationName,
          code: locationCode,
          description: locationDescription,
          is_default: locationDefault,
        });
      } else {
        await stockLocationService.createLocation({
          deposit_id: locationDepositId,
          name: locationName,
          code: locationCode,
          description: locationDescription,
          is_default: locationDefault,
        });
      }

      const locationData = await stockLocationService.listLocations();
      setLocations(locationData);
      setSelectedDepositId(locationDepositId);
      setLocationsExpanded(true);
      setLocationOpen(false);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Nao foi possivel salvar o local.');
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
      const locationLabel = getLocationDisplayName(location).toLowerCase();
      const matchesDeposit = selectedDepositId === 'all' || location.deposit_id === selectedDepositId;
      const matchesSearch = !term ||
        locationLabel.includes(term) ||
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

  const closeLocationContents = (force: boolean | React.MouseEvent = false) => {
    if (contentsActionProductId && force !== true) return;
    setContentsOpen(false);
    setContentsLocation(null);
    setContentsItems([]);
    setContentsError(null);
  };

  const buildProductFromContentItem = (item: LocationContentItem): StockLocationProductSearchResult => ({
    id: item.product_id,
    name: item.product_name,
    sku: item.sku || null,
    ean: item.ean || null,
    stock_quantity: Number(item.total_stock || item.quantity || 0),
    images: item.product_image ? [item.product_image] : null,
  });

  const buildDistributionFromContentItem = (item: LocationContentItem): ProductStockLocation => ({
    id: `content-${item.product_id}-${item.location_id || 'unknown'}`,
    company_id: '',
    product_id: item.product_id,
    deposit_id: item.deposit_id || '',
    location_id: item.location_id || '',
    quantity: Number(item.quantity || 0),
    reserved_quantity: Number(item.reserved_quantity || 0),
    created_at: '',
    updated_at: '',
    deposit: item.deposit_id ? depositById[item.deposit_id] || null : null,
    location: item.location_id ? locations.find((location) => location.id === item.location_id) || null : null,
  });

  const getDefaultStockTarget = (excludeLocationId = '') => {
    const preferredDeposit =
      deposits.find((deposit) => deposit.is_default && deposit.type === 'store') ||
      deposits.find((deposit) => deposit.type === 'store') ||
      deposits.find((deposit) => deposit.is_default) ||
      deposits[0];

    if (!preferredDeposit) return null;

    const preferredLocation =
      locations.find((location) => location.deposit_id === preferredDeposit.id && location.is_default && location.id !== excludeLocationId) ||
      locations.find((location) => location.deposit_id === preferredDeposit.id && location.id !== excludeLocationId) ||
      locations.find((location) => location.id !== excludeLocationId);

    if (!preferredLocation) return null;

    return {
      depositId: preferredLocation.deposit_id || preferredDeposit.id,
      locationId: preferredLocation.id,
    };
  };

  /**
   * Quebra o nome completo em "produto base" + "variação". Primeiro tenta detectar
   * padrões "Cor:X" / "Tamanho:Y" no próprio nome. Se não achar, recorre ao specs
   * do produto (color, size, ram, storage, voltage) — comum em produtos cujo nome
   * não traz o sufixo da variação.
   */
  const getSpecValue = (specs: Record<string, any> | null | undefined, keys: string[]): string => {
    if (!specs || typeof specs !== 'object') return '';
    for (const key of keys) {
      const value = specs[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  };

  const inferColorVariationFromName = (fullName: string): { name: string; variation: string } | null => {
    const colors = [
      'transparente',
      'incolor',
      'preto',
      'preta',
      'branco',
      'branca',
      'azul',
      'vermelho',
      'vermelha',
      'verde',
      'rosa',
      'roxo',
      'roxa',
      'lilas',
      'lilás',
      'cinza',
      'prata',
      'dourado',
      'dourada',
      'grafite',
      'marrom',
      'salmao',
      'salmão',
    ];
    for (const color of colors) {
      const colorPattern = new RegExp(`(^|\\s)${color}(?=\\s|$)`, 'i');
      if (!colorPattern.test(fullName)) continue;

      const nameWithoutColor = fullName.replace(colorPattern, '$1').replace(/\s+/g, ' ').trim();
      const label = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
      return { name: nameWithoutColor || fullName.trim(), variation: `Cor:${label}` };
    }
    return null;
  };

  const splitNameVariation = (fullName: string, specs?: Record<string, any> | null): { name: string; variation: string } => {
    const match = fullName.match(/^(.*?)\s+((?:Cor|Tamanho|Capacidade|RAM|Armazenamento|Memória|Voltagem)\s*:\s*.+)$/i);
    if (match) {
      return { name: match[1].trim(), variation: match[2].trim() };
    }
    if (specs && typeof specs === 'object') {
      const labels: Array<[string[], string]> = [
        [['color', 'cor', 'Cor'], 'Cor'],
        [['size', 'tamanho', 'Tamanho'], 'Tamanho'],
        [['ram', 'RAM'], 'RAM'],
        [['storage', 'armazenamento', 'Armazenamento'], 'Armazenamento'],
        [['version', 'versao', 'Versao', 'versão', 'Versão'], 'Versão'],
        [['voltage', 'voltagem', 'Voltagem'], 'Voltagem'],
        [['capacity', 'capacidade', 'Capacidade'], 'Capacidade'],
        [['memory', 'memoria', 'Memoria', 'memória', 'Memória'], 'Memória'],
      ];
      const parts: string[] = [];
      for (const [keys, label] of labels) {
        const value = getSpecValue(specs, keys);
        if (value) parts.push(`${label}:${value}`);
      }
      if (parts.length > 0) {
        return { name: fullName.trim(), variation: parts.join(' · ') };
      }
    }
    const inferred = inferColorVariationFromName(fullName);
    if (inferred) return inferred;
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
    setBatchToLocationId('');
    setBatchToLocationSearch('');
  };

  const batchDestinationLocations = useMemo(() => {
    return locations
      .filter((location) => !batchToDepositId || location.deposit_id === batchToDepositId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [batchToDepositId, locations]);

  const handleBatchToLocationSearchChange = (value: string) => {
    setBatchToLocationSearch(value);
    const selected = batchDestinationLocations.find((location) => {
      const label = getLocationDisplayName(location);
      return label === value || location.name === value || location.code === value;
    });
    setBatchToLocationId(selected?.id || '');
  };

  const getDistributionAvailable = (distribution: ProductStockLocation) => {
    return Math.max(0, Number(distribution.quantity || 0) - Number(distribution.reserved_quantity || 0));
  };

  const getBatchTransferSources = (item: BatchItem, toLocationId = batchToLocationId) => {
    return item.distribution
      .filter((source) => {
        if (source.location_id === toLocationId) return false;
        if (item.fromLocationId && source.location_id !== item.fromLocationId) return false;
        return getDistributionAvailable(source) > 0;
      })
      .sort((a, b) => getDistributionAvailable(b) - getDistributionAvailable(a));
  };

  const getBatchUndistributedQuantity = (item: BatchItem) => {
    const productStockQuantity = Math.max(0, Math.trunc(Number(item.product.stock_quantity || 0)));
    const localStockQuantity = item.distribution.reduce((sum, source) => sum + Math.max(0, Number(source.quantity || 0)), 0);
    return Math.max(0, productStockQuantity - localStockQuantity);
  };

  const getBatchExcessLocationQuantity = (item: BatchItem) => {
    const productStockQuantity = Math.max(0, Math.trunc(Number(item.product.stock_quantity || 0)));
    const localStockQuantity = item.distribution.reduce((sum, source) => sum + Math.max(0, Number(source.quantity || 0)), 0);
    return Math.max(0, localStockQuantity - productStockQuantity);
  };

  const getBatchTransferAvailable = (item: BatchItem, toLocationId = batchToLocationId) => {
    const sourceAvailable = getBatchTransferSources(item, toLocationId)
      .reduce((sum, source) => sum + getDistributionAvailable(source), 0);
    return item.fromLocationId ? sourceAvailable : 0;
  };

  const handleBatchOriginChange = (productId: string, selectedOriginLocationId: string) => {
    setBatchItems(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const selectedSource = item.distribution.find(source => source.location_id === selectedOriginLocationId);
      const next = {
        ...item,
        fromDepositId: selectedSource?.deposit_id || '',
        fromLocationId: selectedOriginLocationId,
      };
      return {
        ...next,
        available: getBatchTransferAvailable(next),
      };
    }));
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
    let candidate = resolveBatchSearchCandidate(term, batchResults);

    if (!candidate) {
      // Resultados ainda não chegaram (scan mais rápido que o debounce de 300ms)
      try {
        const fresh = await stockLocationService.searchProducts(term);
        candidate = resolveBatchSearchCandidate(term, fresh);
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

  const handleBatchSearchEnterWithQueue = async () => {
    const term = batchSearch.trim();
    if (!term) return;
    setBatchError(null);
    let candidate: StockLocationProductSearchResult | undefined;

    try {
      const results = await stockLocationService.searchProducts(term);
      candidate = resolveBatchSearchCandidate(term, results);
    } catch {
      // Continua como erro de leitura para o operador reler depois.
    }

    if (!candidate) {
      addBatchReadError(term, `Produto nao encontrado para "${term}".`);
      playBatchErrorSound();
      setBatchSearch('');
      setBatchResults([]);
      focusBatchSearchInput();
      return;
    }

    await addBatchItem(candidate);
    clearBatchReadErrorForProduct(candidate, term);
  };

  const addBatchItem = async (product: StockLocationProductSearchResult) => {
    setBatchError(null);
    const existingBatchItem = findBatchItemByProduct(product);
    if (existingBatchItem) {
      setBatchItems(prev => {
        const existing = prev.find(i => i.product.id === existingBatchItem.product.id);
        if (!existing) return prev;
        const incremented = {
          ...existing,
          quantity: String((Number(existing.quantity) || 0) + 1),
        };
        const withoutExisting = prev.filter(i => i.product.id !== existingBatchItem.product.id);
        return [incremented, ...withoutExisting];
      });
      setBatchSearch('');
      setBatchResults(prev => prev.filter(result => !hasBatchProductIdentityOverlap(result, product)));
      focusBatchSearchInput();
      return;
    }

    try {
      const distribution = await stockLocationService.getProductStockDistribution(product.id);
      const availableSources = distribution.filter(source => getDistributionAvailable(source) > 0);
      const productStockQuantity = Math.max(0, Math.trunc(Number(product.stock_quantity || 0)));
      const localStockQuantity = distribution.reduce((sum, source) => sum + Math.max(0, Number(source.quantity || 0)), 0);
      const undistributedQuantity = Math.max(0, productStockQuantity - localStockQuantity);
      const defaultSource = availableSources.length === 1 && undistributedQuantity <= 0 ? availableSources[0] : null;
      const item: BatchItem = {
        product,
        fromDepositId: defaultSource?.deposit_id || '',
        fromLocationId: defaultSource?.location_id || '',
        available: defaultSource ? getDistributionAvailable(defaultSource) : 0,
        quantity: '1',
        distribution,
      };
      setBatchItems(prev => [item, ...prev]);
      setBatchSearch('');
      setBatchResults(prev => prev.filter(result => !hasBatchProductIdentityOverlap(result, product)));
      focusBatchSearchInput();
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

  const decrementBatchItemQuantity = (productId: string) => {
    setBatchItems(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const quantity = Math.max(1, (Number(item.quantity) || 1) - 1);
      return { ...item, quantity: String(quantity) };
    }));
  };

  const incrementBatchItemQuantity = (productId: string) => {
    setBatchItems(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      return { ...item, quantity: String((Number(item.quantity) || 0) + 1) };
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

    const preparedBatchItems = batchItems.map((item) => ({
      ...item,
      available: getBatchTransferAvailable(item, batchToLocationId),
    }));
    setBatchItems(preparedBatchItems);

    const missingOrigin = preparedBatchItems.find((item) => !item.fromLocationId);
    if (missingOrigin) {
      setBatchError(`Escolha a origem de cada produto antes de transferir. Falta origem para ${missingOrigin.product.sku || missingOrigin.product.name}.`);
      return;
    }

    const invalidOverAvailable = preparedBatchItems.find((item) => {
      const qty = Number(item.quantity);
      const available = getBatchTransferAvailable(item, batchToLocationId);
      return Number.isFinite(qty) && qty > available;
    });
    if (invalidOverAvailable) {
      setBatchError(`Quantidade maior que o saldo transferível para ${invalidOverAvailable.product.sku || invalidOverAvailable.product.name}.`);
      return;
    }

    const transferRequests = preparedBatchItems.flatMap((item) => {
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
      setBatchToLocationId('');
      setBatchToLocationSearch('');
      setBatchProgress(null);
      window.localStorage.removeItem(BATCH_TRANSFER_STORAGE_KEY);
      // Recarrega divergências/movimentos
      loadData();
    }
  };

  const transferDeactivationItems = async (mode: 'selected' | 'all') => {
    if (!deactivationTarget || !deactivationCheck) return;

    const selectedIds = new Set(deactivationSelectedProductIds);
    const items = deactivationCheck.pending_items.filter((item) => mode === 'all' || selectedIds.has(item.product_id));

    if (items.length === 0) {
      setDeactivationError('Selecione pelo menos um produto para transferir.');
      return;
    }

    if (!deactivationToDepositId || !deactivationToLocationId) {
      setDeactivationError('Selecione o deposito e o local de destino.');
      return;
    }

    const sameLocation = items.find((item) => item.location_id === deactivationToLocationId);
    if (sameLocation) {
      setDeactivationError('O destino precisa ser diferente do local que sera desativado.');
      return;
    }

    const reservedItem = items.find((item) => item.available < item.quantity);
    if (reservedItem) {
      setDeactivationError(`O produto ${reservedItem.sku || reservedItem.product_name} tem saldo reservado. Libere a reserva antes de desativar.`);
      return;
    }

    setDeactivationSaving(true);
    setDeactivationError(null);

    const failed: { item: StockPathDeactivationItem; error: string }[] = [];
    for (const item of items) {
      try {
        await stockLocationService.transferStockLocation({
          product_id: item.product_id,
          from_deposit_id: item.deposit_id,
          from_location_id: item.location_id,
          to_deposit_id: deactivationToDepositId,
          to_location_id: deactivationToLocationId,
          quantity: item.quantity,
          reason: deactivationTarget.type === 'deposit' ? 'Transferencia para desativacao de deposito' : 'Transferencia para desativacao de local',
          notes: `Transferencia obrigatoria antes de desativar ${deactivationTarget.name}`,
        });
      } catch (error) {
        failed.push({ item, error: error instanceof Error ? error.message : 'falha' });
      }
    }

    setDeactivationSaving(false);

    if (failed.length > 0) {
      const message = `${items.length - failed.length} transferencia(s) ok, ${failed.length} falharam: ${failed.slice(0, 3).map(({ item }) => item.sku || item.product_name).join(', ')}`;
      setDeactivationError(message);
      toast.error(message);
    } else {
      toast.success(`${items.length} produto(s) transferido(s) com sucesso.`);
    }

    await Promise.all([
      loadDeactivationCheck(deactivationTarget),
      loadData(),
    ]);
  };

  const confirmDeactivation = async () => {
    if (!deactivationTarget || !deactivationCheck) return;

    if (!deactivationCheck.can_deactivate) {
      setDeactivationError('Produtos pendentes precisam ser transferidos antes de desativar.');
      return;
    }

    setDeactivationSaving(true);
    setDeactivationError(null);
    try {
      if (deactivationTarget.type === 'deposit') {
        await stockLocationService.deactivateDeposit(deactivationTarget.id);
      } else {
        await stockLocationService.deactivateLocation(deactivationTarget.id);
      }

      toast.success(`${deactivationTarget.type === 'deposit' ? 'Deposito' : 'Local'} desativado com sucesso.`);
      setDeactivationOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel desativar.';
      setDeactivationError(message);
      toast.error(message);
    } finally {
      setDeactivationSaving(false);
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

  const handleContentTransferFromRow = async (item: LocationContentItem) => {
    if (!item.deposit_id || !item.location_id) {
      setContentsError('Este produto nao tem origem valida para transferencia.');
      return;
    }

    setContentsActionProductId(item.product_id);
    setContentsError(null);

    try {
      const product = buildProductFromContentItem(item);
      const rowDistribution = buildDistributionFromContentItem(item);
      setSelectedProduct(product);
      setProductSearch(product.name);
      setProductLoading(true);
      setProductError(null);
      let distribution = [rowDistribution];
      try {
        const loadedDistribution = await loadProductDistribution(item.product_id);
        const hasCurrentLocation = loadedDistribution.some((source) => source.location_id === item.location_id);
        distribution = hasCurrentLocation ? loadedDistribution : [rowDistribution, ...loadedDistribution];
        setProductDistribution(distribution);
      } catch (distributionError) {
        setProductDistribution(distribution);
      }
      setQuickTransferDestinationDefaults(distribution);
      const target = getDefaultStockTarget(item.location_id || '');
      setTransferFromDepositId(item.deposit_id || '');
      setTransferFromLocationId(item.location_id || '');
      setTransferToDepositId(target?.depositId || '');
      setTransferToLocationId(target?.locationId || '');
      setTransferQuantity(item.available > 0 ? String(item.available) : '1');
      setTransferReason('');
      setTransferNotes('');
      setTransferError(null);
      closeLocationContents(true);
      setTransferOpen(true);
    } catch (err: any) {
      console.error('[StockLocationsPage] transfer from contents', err);
      setContentsError(err?.message || 'Nao foi possivel abrir a transferencia deste item.');
    } finally {
      setProductLoading(false);
      setContentsActionProductId(null);
    }
  };

  const handleReturnContentItemToStore = async (item: LocationContentItem) => {
    if (!item.deposit_id || !item.location_id) {
      setContentsError('Este produto nao tem origem valida para voltar para loja.');
      return;
    }

    const target = getDefaultStockTarget(item.location_id);
    if (!target) {
      setContentsError('Cadastre um deposito/local padrao da loja antes de devolver itens.');
      return;
    }

    if (target.locationId === item.location_id) {
      setContentsError('Este produto ja esta no local padrao da loja.');
      return;
    }

    if (item.available <= 0) {
      setContentsError('Nao ha saldo disponivel para devolver; existe quantidade reservada neste local.');
      return;
    }

    try {
      setContentsLoading(true);
      setContentsError(null);
      await stockLocationService.transferStockLocation({
        product_id: item.product_id,
        from_deposit_id: item.deposit_id,
        from_location_id: item.location_id,
        to_deposit_id: target.depositId,
        to_location_id: target.locationId,
        quantity: item.available,
        reason: 'Retorno automatico para loja',
        notes: item.sku ? `Removido da caixa/local pelo painel. SKU: ${item.sku}` : 'Removido da caixa/local pelo painel.',
      });

      if (contentsLocation) {
        const nextItems = await stockLocationService.getLocationContents(contentsLocation.id);
        setContentsItems(nextItems);
      }

      await Promise.all([
        stockLocationService.listMovements(getMovementQueryFilters()).then(setMovements),
        stockLocationService.getStockDivergences().then(setDivergences),
      ]);

      if (selectedProduct?.id === item.product_id) {
        const distribution = await loadProductDistribution(item.product_id);
        setSelectedProduct({
          ...selectedProduct,
          stock_quantity: distribution.reduce((total, row) => total + row.quantity, 0),
        });
      }
    } catch (err: any) {
      setContentsError(err?.message || 'Nao foi possivel devolver o produto para loja.');
    } finally {
      setContentsLoading(false);
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
        stockLocationService.listMovements(getMovementQueryFilters()).then(setMovements),
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
        stockLocationService.listMovements(getMovementQueryFilters()).then(setMovements),
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
  const deactivationTargetLocations = locations.filter((location) => {
    if (!location.is_active) return false;
    if (deactivationTarget?.type === 'deposit' && location.deposit_id === deactivationTarget.id) return false;
    if (deactivationTarget?.type === 'location' && location.id === deactivationTarget.id) return false;
    return true;
  });
  const deactivationPendingItems = deactivationCheck?.pending_items || [];
  const deactivationAllSelected = deactivationPendingItems.length > 0 &&
    deactivationPendingItems.every((item) => deactivationSelectedProductIds.includes(item.product_id));

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
        stockLocationService.listMovements(getMovementQueryFilters()).then(setMovements),
        stockLocationService.getStockDivergences().then(setDivergences),
      ]);

      const targetLocationName = locations.find((location) => location.id === transferToLocationId)?.name || 'destino selecionado';
      toast.success(`${quantity} unidade(s) de ${selectedProduct.name} transferida(s) para ${targetLocationName}.`);
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
                <div
                  key={deposit.id}
                  className={`w-full px-5 py-4 text-left transition hover:bg-slate-50 ${
                    selectedDepositId === deposit.id ? 'bg-blue-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedDepositId(deposit.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{deposit.name}</p>
                        {deposit.is_default && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Padrão</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{deposit.code}</p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{deposit.type}</span>
                      <button
                        type="button"
                        onClick={() => openEditDepositModal(deposit)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        title="Renomear deposito"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDepositDeactivation(deposit)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:border-red-300 hover:bg-red-50"
                        title="Desativar deposito"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">Locais internos</h2>
                <p className="mt-1 text-sm text-slate-500">Prateleiras, balcões, caixas e posições dentro dos depósitos.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => setLocationsExpanded((prev) => !prev)}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {locationsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {locationsExpanded ? 'Ocultar locais' : `Mostrar locais (${filteredLocations.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => openLocationModal()}
                  disabled={deposits.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} />
                  Novo local
                </button>
              </div>
            </div>

            {locationsExpanded && (
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar local..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
            )}
          </div>

          {locationsExpanded ? (
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
                        <div className="font-semibold text-slate-900">{getLocationDisplayName(location)}</div>
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
                          onClick={() => openEditLocationModal(location)}
                          className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          title="Renomear local"
                        >
                          <Pencil size={14} />
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => openLocationContents(location)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          title="Ver produtos armazenados neste local"
                        >
                          <Eye size={14} />
                          Ver conteúdo
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrLocation(location)}
                          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                          title="Imprimir etiqueta com nome e QR da caixa"
                        >
                          <QrCode size={14} />
                          QR da caixa
                        </button>
                        <button
                          type="button"
                          onClick={() => openLocationDeactivation(location)}
                          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50"
                          title="Desativar local"
                        >
                          <Trash2 size={14} />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          ) : (
            <div className="border-t border-slate-100 p-5 text-sm text-slate-500">
              {filteredLocations.length} locais ocultos. Clique em Mostrar locais para consultar, editar ou ver conteudo.
            </div>
          )}
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
                      <option key={location.id} value={location.id}>{getLocationDisplayName(location)}</option>
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
              ref={batchSearchInputRef}
              type="search"
              value={batchSearch}
              onChange={(event) => setBatchSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleBatchSearchEnterWithQueue();
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
                    onClick={async () => {
                      await addBatchItem(product);
                      clearBatchReadErrorForProduct(product);
                    }}
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

          {batchReadErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Erros de leitura ({batchReadErrors.length})</p>
                <button
                  type="button"
                  onClick={() => setBatchReadErrors([])}
                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Limpar erros
                </button>
              </div>
              <ul className="mt-2 divide-y divide-red-100">
                {batchReadErrors.map((error) => (
                  <li key={error.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-red-950">{error.term}</p>
                      <p className="text-xs text-red-700">
                        {error.message}
                        {error.count > 1 ? ` · ${error.count} tentativas` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatchReadErrors(prev => prev.filter(item => item.id !== error.id))}
                      className="shrink-0 rounded-lg p-1 text-red-500 hover:bg-red-100 hover:text-red-700"
                      title="Remover erro"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabela de itens do lote */}
          {batchItems.length === 0 ? (
            <EmptyBlock label="Nenhum produto na lista. Pesquise acima pra adicionar." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Produto</th>
                    <th className="px-3 py-3">Saindo de</th>
                    <th className="px-3 py-3 text-right">Disponível</th>
                    <th className="px-3 py-3 text-center">Quantidade a movimentar</th>
                    <th className="px-3 py-3 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchItems.map((item) => {
                    const originOptions = item.distribution
                      .filter((source) => getDistributionAvailable(source) > 0)
                      .sort((a, b) => getDistributionAvailable(b) - getDistributionAvailable(a));
                    const originSummaryRows = item.distribution
                      .sort((a, b) => Math.max(0, Number(b.quantity || 0)) - Math.max(0, Number(a.quantity || 0)));
                    const transferableOriginCount = originOptions.filter((source) => source.location_id !== batchToLocationId).length;
                    const selectedOriginLocationId = item.fromLocationId || '';
                    const undistributedQuantity = getBatchUndistributedQuantity(item);
                    const excessLocationQuantity = getBatchExcessLocationQuantity(item);
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
                          <div className="space-y-2 text-xs text-slate-600">
                            <label className="block">
                                <span className="mb-1 block font-semibold text-slate-700">Estoque de origem</span>
                                <select
                                  value={selectedOriginLocationId}
                                  onChange={(event) => handleBatchOriginChange(item.product.id, event.target.value)}
                                  className="h-9 w-full min-w-56 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                  title="Escolher origem da transferência"
                                >
                                  <option value="">
                                  {transferableOriginCount === 1 ? 'Selecione a origem (1 local)' : `Selecione a origem (${transferableOriginCount} locais)`}
                                </option>
                                {originOptions.map((source) => (
                                  <option
                                    key={source.location_id}
                                    value={source.location_id}
                                    disabled={source.location_id === batchToLocationId}
                                  >
                                    {source.deposit?.name || '-'} / {getLocationDisplayName(source.location)} - {getDistributionAvailable(source)} disp.
                                    {source.location_id === batchToLocationId ? ' - ja esta no destino' : ''}
                                  </option>
                                ))}
                                </select>
                              </label>
                            {originSummaryRows.length > 0 && (
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-700">Estoque registrado por origem</p>
                                {originSummaryRows.map((source) => {
                                  const isSelected = source.location_id === selectedOriginLocationId;
                                  const physicalQuantity = Math.max(0, Number(source.quantity || 0));
                                  const availableQuantity = getDistributionAvailable(source);
                                  return (
                                    <div
                                      key={`${source.location_id}-summary`}
                                      className={`flex items-center justify-between gap-3 rounded-md border px-2 py-1 ${
                                        isSelected ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-100 bg-slate-50 text-slate-600'
                                      }`}
                                    >
                                      <span className="truncate">{source.deposit?.name || '-'} / {getLocationDisplayName(source.location)}</span>
                                      <span className="shrink-0 font-bold">
                                        {physicalQuantity} unidade{physicalQuantity === 1 ? '' : 's'}
                                        {availableQuantity !== physicalQuantity ? ` (${availableQuantity} disp.)` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {undistributedQuantity > 0 && (
                              <p className="text-amber-700">+ {undistributedQuantity} sem local definido, ajuste a origem antes de transferir</p>
                            )}
                            {excessLocationQuantity > 0 && (
                              <p className="text-red-700">
                                Locais somam {excessLocationQuantity} unidade{excessLocationQuantity === 1 ? '' : 's'} a mais que o estoque total; confira a divergencia antes de transferir.
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-emerald-700">{transferAvailable}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => decrementBatchItemQuantity(item.product.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-bold text-slate-700 transition hover:bg-slate-50"
                              aria-label="Diminuir quantidade"
                              title="Diminuir quantidade"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateBatchItem(item.product.id, { quantity: e.target.value })}
                              onFocus={(e) => e.target.select()}
                              className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-sm text-center outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => incrementBatchItemQuantity(item.product.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-base font-bold text-slate-700 transition hover:bg-slate-50"
                              aria-label="Aumentar quantidade"
                              title="Aumentar quantidade"
                            >
                              +
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
                  <input
                    type="text"
                    value={batchToLocationSearch}
                    onChange={(e) => handleBatchToLocationSearchChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    list="batch-destination-locations"
                    placeholder="Digite ou selecione o local"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  />
                  <datalist id="batch-destination-locations">
                    {batchDestinationLocations.map((l) => (
                      <option key={l.id} value={getLocationDisplayName(l)}>{l.code}</option>
                    ))}
                  </datalist>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Divergências</h2>
              <p className="mt-1 text-sm text-slate-500">Produtos cuja soma por local está diferente do estoque total atual.</p>
            </div>
            {divergences.length > 0 && (
              <button
                type="button"
                onClick={() => setDivergencesExpanded((prev) => !prev)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                {divergencesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {divergencesExpanded ? 'Ocultar divergencias' : `Mostrar divergencias (${divergences.length})`}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Carregando divergências..." />
        ) : divergences.length === 0 ? (
          <EmptyBlock label="Nenhuma divergência encontrada." />
        ) : !divergencesExpanded ? (
          <div className="p-5 text-sm text-slate-500">
            {divergences.length} divergencias ocultas. Clique em Mostrar divergencias para conferir os produtos.
          </div>
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Histórico de movimentações</h2>
              <p className="mt-1 text-sm text-slate-500">Últimos registros auditáveis de estoque por depósito/local.</p>
            </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={movementPeriodDays}
                onChange={(event) => setMovementPeriodDays(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                aria-label="Periodo do historico"
              >
                <option value="1">Hoje</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="all">Tudo</option>
              </select>
              <button type="button" onClick={copyMovementLog} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Copy size={15} />
                Copiar log
              </button>
              <button type="button" onClick={downloadMovementLogTxt} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <FileDown size={15} />
                Baixar TXT
              </button>
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
                  <th className="px-5 py-3">Origem</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Caminho</th>
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
                      <MovementSourceIcon source={movement.source_device} />
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {formatMovementType(movement.movement_type)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{formatMovementProduct(movement)}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{formatMovementPath(movement)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">{movement.quantity}</td>
                    <td className="px-5 py-4 text-slate-700">{formatMovementReason(movement.reason)}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {renderMovementReference(movement)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {qrLocation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #stock-location-qr-label, #stock-location-qr-label * { visibility: visible !important; }
              #stock-location-qr-label {
                position: fixed !important;
                inset: 0 auto auto 0 !important;
                width: 80mm !important;
                min-height: 50mm !important;
                margin: 0 !important;
                border: 0 !important;
                box-shadow: none !important;
              }
            }
          `}</style>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div
              id="stock-location-qr-label"
              className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-slate-900 bg-white p-6 text-center"
            >
              <h2 className="mb-5 text-3xl font-black text-slate-950">
                {getLocationDisplayName(qrLocation)}
              </h2>
              <QRCodeSVG
                value={buildStockLocationQrValue(qrLocation)}
                size={220}
                level="H"
                includeMargin
                aria-label={`QR da ${getLocationDisplayName(qrLocation)}`}
              />
            </div>
            <p className="mt-4 text-center text-sm text-slate-500">
              A impressão contém somente o nome e o QR da caixa.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setQrLocation(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <Printer size={17} />
                Imprimir QR
              </button>
            </div>
          </div>
        </div>
      )}

      {depositOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submitDeposit}
            className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editingDepositId ? 'Renomear deposito' : 'Novo deposito'}</h2>
                <p className="mt-1 text-sm text-slate-500">{editingDepositId ? 'Atualize nome, codigo e tipo do deposito.' : 'Cadastre uma loja, galpao ou ponto fisico de estoque.'}</p>
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
                    placeholder={editingDepositId ? 'Automático pelo nome' : 'Automatico se vazio'}
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
                {editingDepositId ? 'Salvar deposito' : 'Criar deposito'}
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
                <h2 className="text-lg font-bold text-slate-900">{editingLocationId ? 'Renomear local' : 'Novo local'}</h2>
                <p className="mt-1 text-sm text-slate-500">{editingLocationId ? 'Atualize nome, codigo e descricao do local.' : 'Cadastre prateleira, balcao, caixa ou posicao interna.'}</p>
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
                  disabled={Boolean(editingLocationId)}
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
                    onChange={(event) => setLocationName(formatLocationName(event.target.value))}
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
                    placeholder={editingLocationId ? 'Automático pelo nome' : 'Automatico se vazio'}
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
                {editingLocationId ? 'Salvar local' : 'Criar local'}
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
                      <option key={location.id} value={location.id}>{getLocationDisplayName(location)}</option>
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
                          <option key={location.id} value={location.id}>{getLocationDisplayName(location)}</option>
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
                          <option key={location.id} value={location.id}>{getLocationDisplayName(location)}</option>
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
                      <option key={location.id} value={location.id}>{getLocationDisplayName(location)}</option>
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
      {deactivationOpen && deactivationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Desativar {deactivationTarget.type === 'deposit' ? 'depósito' : 'local'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {deactivationTarget.name} ficará como Desativado no histórico. Para concluir, todos os produtos precisam sair deste caminho.
                </p>
              </div>
              <button type="button" onClick={closeDeactivationModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {deactivationError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{deactivationError}</div>
              )}

              {deactivationLoading ? (
                <LoadingBlock label="Conferindo produtos pendentes..." />
              ) : deactivationPendingItems.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Nenhum produto pendente. Este caminho ja pode ser desativado.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Produtos pendentes</p>
                    <p className="mt-1">Transfira todos os itens abaixo para outro local antes de desativar.</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1 block font-semibold text-slate-700">Depósito de destino</span>
                      <select
                        value={deactivationToDepositId}
                        onChange={(event) => {
                          const depositId = event.target.value;
                          const firstLocation = deactivationTargetLocations.find((location) => location.deposit_id === depositId);
                          setDeactivationToDepositId(depositId);
                          setDeactivationToLocationId(firstLocation?.id || '');
                        }}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Selecione...</option>
                        {deposits
                          .filter((deposit) => deactivationTargetLocations.some((location) => location.deposit_id === deposit.id))
                          .map((deposit) => (
                            <option key={deposit.id} value={deposit.id}>{deposit.name}</option>
                          ))}
                      </select>
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block font-semibold text-slate-700">Local de destino</span>
                      <select value={deactivationToLocationId} onChange={(event) => setDeactivationToLocationId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                        <option value="">Selecione...</option>
                        {deactivationTargetLocations
                          .filter((location) => !deactivationToDepositId || location.deposit_id === deactivationToDepositId)
                          .map((location) => (
                            <option key={location.id} value={location.id}>{getLocationDisplayName(location)}</option>
                          ))}
                      </select>
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={deactivationAllSelected}
                              onChange={(event) => {
                                setDeactivationSelectedProductIds(event.target.checked
                                  ? deactivationPendingItems.map((item) => item.product_id)
                                  : []);
                              }}
                            />
                          </th>
                          <th className="px-3 py-3">Produto</th>
                          <th className="px-3 py-3">Origem</th>
                          <th className="px-3 py-3 text-right">Físico</th>
                          <th className="px-3 py-3 text-right">Reservado</th>
                          <th className="px-3 py-3 text-right">Disponível</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deactivationPendingItems.map((item) => (
                          <tr key={`${item.product_id}-${item.location_id}`} className="hover:bg-slate-50">
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={deactivationSelectedProductIds.includes(item.product_id)}
                                onChange={(event) => {
                                  setDeactivationSelectedProductIds((current) => event.target.checked
                                    ? Array.from(new Set([...current, item.product_id]))
                                    : current.filter((id) => id !== item.product_id));
                                }}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-slate-900">{item.product_name}</p>
                              <p className="text-xs text-slate-500">{item.sku || item.ean || '-'}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{item.deposit_name || '-'} / {item.location_name || '-'}</td>
                            <td className="px-3 py-3 text-right font-semibold">{item.quantity}</td>
                            <td className="px-3 py-3 text-right text-slate-600">{item.reserved_quantity}</td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-700">{item.available}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              {deactivationPendingItems.length > 0 && (
                <>
                  <button type="button" onClick={() => transferDeactivationItems('selected')} disabled={deactivationSaving || deactivationSelectedProductIds.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {deactivationSaving && <Loader2 size={16} className="animate-spin" />}
                    Transferir selecionados
                  </button>
                  <button type="button" onClick={() => transferDeactivationItems('all')} disabled={deactivationSaving} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {deactivationSaving && <Loader2 size={16} className="animate-spin" />}
                    Transferir todos
                  </button>
                </>
              )}
              <button type="button" onClick={confirmDeactivation} disabled={deactivationSaving || deactivationLoading || deactivationPendingItems.length > 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {deactivationSaving && <Loader2 size={16} className="animate-spin" />}
                Confirmar desativação
              </button>
            </div>
          </div>
        </div>
      )}

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
                              onClick={() => handleContentTransferFromRow(item)}
                              disabled={Boolean(contentsActionProductId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              title="Transferir este produto a partir deste local"
                            >
                              {contentsActionProductId === item.product_id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <ArrowRightLeft size={12} />
                              )}
                              {contentsActionProductId === item.product_id ? 'Abrindo...' : 'Transferir'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReturnContentItemToStore(item)}
                              disabled={Boolean(contentsActionProductId)}
                              className="ml-2 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100"
                              title="Remover desta caixa e voltar para a loja"
                            >
                              <RotateCcw size={12} />
                              Voltar para loja
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

function buildStockLocationQrValue(location: StockLocation): string {
  return `mdv://stock-location/${location.id}`;
}

const MovementSourceIcon: React.FC<{ source?: StockLocationMovement['source_device'] }> = ({ source }) => {
  if (source === 'mobile') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700" title="Movimentação feita pelo celular">
        <Smartphone size={17} />
        Celular
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700" title="Movimentação feita pelo computador">
      <Monitor size={17} />
      Computador
    </span>
  );
};

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

function formatMovementReason(reason: string): string {
  const clean = String(reason || '').trim();
  const labels: Record<string, string> = {
    manual_transfer: 'Transferência manual',
    manual_entry: 'Entrada manual de estoque',
    manual_adjustment: 'Ajuste manual de estoque',
    distribution_open: 'Abertura da distribuição por local',
    inventory: 'Inventário de estoque',
    undistributed_stock: 'Estoque ainda não distribuído',
    initial_migration: 'Migração inicial do estoque',
    external_stock_total: 'Sincronização do estoque total',
    external_stock_reentry: 'Reentrada por sincronização externa',
    bling_stock_sync: 'Sincronização de estoque Bling/Shopee',
    bling_stock_reentry: 'Reentrada de estoque Bling/Shopee',
    prices_stock_update: 'Atualização comercial do estoque',
  };
  if (labels[clean]) return labels[clean];

  const pdvSale = clean.match(/^Venda PDV #([0-9a-f-]{8,})$/i);
  if (pdvSale) return `Venda PDV #${pdvSale[1].slice(0, 8).toUpperCase()}`;
  const onlineOrder = clean.match(/^(Pedido online|Reserva pedido online|Baixa de reserva pedido online|Libera(?:ç|c)[aã]o reserva pedido online) #([0-9a-f-]{8,})$/i);
  if (onlineOrder) return `${onlineOrder[1]} #${onlineOrder[2].slice(0, 8).toUpperCase()}`;
  const shopeeOrder = clean.match(/^(Venda|Pedido|Reserva)(?: da)? Shopee #([A-Z0-9-]+)$/i);
  if (shopeeOrder) return `${shopeeOrder[1]} Shopee #${shopeeOrder[2]}`;
  return clean || '-';
}

function formatMovementReferenceType(type?: string | null): string {
  const clean = String(type || '').trim();
  const labels: Record<string, string> = {
    sale: 'Venda PDV',
    sale_restore: 'Estorno de venda',
    order: 'Pedido online',
    order_reservation: 'Reserva de pedido online',
    order_release: 'Liberação de pedido online',
    order_restore: 'Estorno de pedido online',
    shopee: 'Venda Shopee',
    shopee_sale: 'Venda Shopee',
    shopee_order: 'Pedido Shopee',
    shopee_order_reservation: 'Reserva de pedido Shopee',
    manual_transfer: 'Transferência manual',
    manual_entry: 'Entrada manual',
    manual_adjustment: 'Ajuste manual',
    distribution_open: 'Abertura da distribuição',
    inventory: 'Inventário',
    undistributed_stock: 'Estoque sem local',
    initial_migration: 'Migração inicial',
    external_stock_total: 'Sincronização externa (Bling/Shopee)',
    external_stock_reentry: 'Reentrada externa (Bling/Shopee)',
  };
  return labels[clean] || clean || '-';
}

function renderMovementReference(movement: StockLocationMovement): React.ReactNode {
  const typeLabel = formatMovementReferenceType(movement.reference_type);
  if (!movement.reference_id) return typeLabel;

  if (movement.reference_type === 'sale') {
    const orderNumber = movement.sale_order_number || movement.reference_id.slice(0, 8).toUpperCase();
    return (
      <span>
        {typeLabel}{' / '}
        <a
          href={`/admin/sales?sale=${encodeURIComponent(movement.reference_id)}`}
          className="font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
        >
          Pedido #{orderNumber}
        </a>
      </span>
    );
  }

  if (movement.reference_type === 'order' || movement.reference_type === 'order_reservation' || movement.reference_type === 'order_release' || movement.reference_type === 'order_restore') {
    return `${typeLabel} / Pedido #${movement.reference_id.slice(0, 8).toUpperCase()}`;
  }

  if (movement.reference_type === 'shopee' || movement.reference_type === 'shopee_sale' || movement.reference_type === 'shopee_order' || movement.reference_type === 'shopee_order_reservation') {
    return `${typeLabel} / Pedido #${movement.reference_id}`;
  }

  return `${typeLabel} / ${movement.reference_id}`;
}

function formatMovementReferenceText(movement: StockLocationMovement): string {
  const typeLabel = formatMovementReferenceType(movement.reference_type);
  if (!movement.reference_id) return typeLabel;
  if (movement.reference_type === 'sale') {
    const orderNumber = movement.sale_order_number || movement.reference_id.slice(0, 8).toUpperCase();
    return `${typeLabel} / Pedido #${orderNumber}`;
  }
  if (movement.reference_type === 'order' || movement.reference_type === 'order_reservation' || movement.reference_type === 'order_release' || movement.reference_type === 'order_restore') {
    return `${typeLabel} / Pedido #${movement.reference_id.slice(0, 8).toUpperCase()}`;
  }
  if (movement.reference_type === 'shopee' || movement.reference_type === 'shopee_sale' || movement.reference_type === 'shopee_order' || movement.reference_type === 'shopee_order_reservation') {
    return `${typeLabel} / Pedido #${movement.reference_id}`;
  }
  return `${typeLabel} / ${movement.reference_id}`;
}

function formatMovementDate(value: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatMovementProduct(movement: StockLocationMovement): string {
  const product = movement.product;
  if (!product) return 'Produto não encontrado';

  // Nome | Variação | SKU
  const specs = product.specs || {};
  const variation = [
    specs.variation,
    specs.variant,
    specs.color,
    specs.ram,
    specs.storage,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ');

  return [
    product.name || '(sem nome)',
    variation || '-',
    product.sku || '-',
  ].join(' | ');
}

function formatMovementPath(movement: StockLocationMovement): string {
  const from = formatMovementPlace(movement.from_deposit, movement.from_location);
  const to = formatMovementPlace(movement.to_deposit, movement.to_location);

  if (from === '-' && to === '-') return '-';
  return `${from} -> ${to}`;
}

function formatMovementPlace(
  deposit?: StockLocationMovement['from_deposit'],
  location?: StockLocationMovement['from_location']
): string {
  const parts = [deposit?.name, location?.name].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '-';
}

function getMovementCreatedAfter(periodDays: string): string | undefined {
  if (periodDays === 'all') return undefined;

  const days = Number(periodDays);
  if (!Number.isFinite(days) || days <= 0) return undefined;

  const start = new Date();
  start.setDate(start.getDate() - days);
  return start.toISOString();
}

function buildMovementLogText(movements: StockLocationMovement[]): string {
  if (movements.length === 0) return '';

  const header = 'Data\tOrigem\tTipo\tProduto\tCaminho\tQtd.\tMotivo\tReferencia';
  const rows = movements.map((movement) => [
    formatMovementDate(movement.created_at),
    movement.source_device === 'mobile' ? 'Celular' : 'Computador',
    formatMovementType(movement.movement_type),
    formatMovementProduct(movement),
    formatMovementPath(movement),
    movement.quantity,
    formatMovementReason(movement.reason),
    formatMovementReferenceText(movement),
  ].join('\t'));

  return [header, ...rows].join('\n');
}
