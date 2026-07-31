import type { Product } from '../types/product';
import type { Unit } from '../types/unit';

export type PdvSerializedUnitOption = {
    id: string;
    unit: Unit;
    label: string;
    detail: string;
    unitData: {
        unitId?: string;
        imei1?: string;
        imei2?: string;
        serial?: string;
    };
};

export type PdvSearchCard =
    | {
        kind: 'serialized-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: true;
        unitOptions: PdvSerializedUnitOption[];
      }
    | {
        kind: 'stock-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: false;
        maxQuantity?: number;
        unitOptions: [];
      };

export type PdvSearchCardDeps = {
    listUnitsByProduct(productId: string): Promise<Unit[]>;
};

type HydratedPdvProduct = {
    product: Product;
    available_units?: Unit[];
    has_unit_history?: boolean;
};

function cleanText(value: unknown): string {
    return String(value || '').trim();
}

function normalizeKeyText(value: unknown): string {
    return cleanText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function isAvailableUnit(unit: Unit): boolean {
    return String(unit.status) === 'available';
}

function formatStockLabel(quantity: number | undefined): string {
    const qty = Math.max(0, Math.trunc(Number(quantity || 0)));
    return qty === 1 ? '1 disponivel' : `${qty} disponiveis`;
}

function formatUnitCountLabel(quantity: number): string {
    return quantity === 1 ? '1 unidade disponivel' : `${quantity} unidades disponiveis`;
}

function stripLegacySerializedSpecs(product: Product): Product {
    const specs = { ...((product as any).specs || {}) };
    for (const key of ['imei', 'imei1', 'imei_1', 'imei2', 'imei_2', 'serial', 'serial_number']) {
        delete specs[key];
    }
    return {
        ...product,
        specs,
    };
}

function buildLegacyProductUnitOption(product: Product): PdvSerializedUnitOption | null {
    if (product.track_inventory && Math.max(0, Math.trunc(Number(product.stock_quantity || 0))) <= 0) return null;

    const specs = (product as any).specs || {};
    const imei1 = cleanText(specs.imei1 || specs.imei_1 || specs.imei);
    const imei2 = cleanText(specs.imei2 || specs.imei_2);
    const serial = cleanText(specs.serial || specs.serial_number);
    if (!imei1 && !imei2 && !serial) return null;

    const identifierParts = [
        imei1 ? `IMEI 1: ${imei1}` : '',
        imei2 ? `IMEI 2: ${imei2}` : '',
        serial ? `Serial: ${serial}` : '',
    ].filter(Boolean);

    return {
        id: `legacy-unit:${product.id}`,
        unit: {
            id: '',
            product_id: product.id,
            imei_1: imei1,
            imei_2: imei2,
            serial_number: serial,
            condition: 'new',
            status: 'available' as any,
            created: '',
            updated: '',
        },
        label: identifierParts.join(' | '),
        detail: '',
        unitData: {
            imei1: imei1 || undefined,
            imei2: imei2 || undefined,
            serial: serial || undefined,
        },
    };
}

function getUnitIdentifierKeys(unitData: PdvSerializedUnitOption['unitData']): string[] {
    return [
        unitData.serial,
        unitData.imei1,
        unitData.imei2,
    ].map(normalizeKeyText).filter(Boolean);
}

function getProductGroupingKey(product: Product): string {
    const modelId = cleanText((product as any).model_id);
    const ram = normalizeKeyText(product.specs?.ram);
    const storage = normalizeKeyText(product.specs?.storage);
    const color = normalizeKeyText(product.specs?.color);

    if (modelId && ram && storage && color) {
        return `model:${modelId}:ram:${ram}:storage:${storage}:color:${color}`;
    }

    const sku = cleanText(product.sku).toLowerCase();
    if (sku) return `sku:${sku}`;
    return `product:${product.id}`;
}

export function buildPdvUnitOption(unit: Unit): PdvSerializedUnitOption {
    const imei1 = cleanText(unit.imei_1);
    const imei2 = cleanText(unit.imei_2);
    const serial = cleanText(unit.serial_number || (unit as any).serial);

    const identifierParts = [
        imei1 ? `IMEI 1: ${imei1}` : '',
        imei2 ? `IMEI 2: ${imei2}` : '',
        serial ? `Serial: ${serial}` : '',
    ].filter(Boolean);
    const label = identifierParts.length > 0
        ? identifierParts.join(' | ')
        : `Unidade: ${String(unit.id || '').slice(0, 8)}`;

    return {
        id: `unit:${unit.id}`,
        unit,
        label,
        detail: '',
        unitData: {
            unitId: unit.id,
            imei1: imei1 || undefined,
            imei2: imei2 || undefined,
            serial: serial || undefined,
        },
    };
}

export function buildStockProductCard(product: Product): Extract<PdvSearchCard, { kind: 'stock-product' }> {
    const displayProduct = stripLegacySerializedSpecs(product);
    return {
        kind: 'stock-product',
        id: `product:${product.id}:stock`,
        product: displayProduct,
        title: displayProduct.name,
        subtitle: `SKU: ${displayProduct.sku || '-'}`,
        stockLabel: displayProduct.track_inventory ? formatStockLabel(displayProduct.stock_quantity) : 'Disponivel',
        quantityLocked: false,
        maxQuantity: displayProduct.track_inventory
            ? Math.max(0, Math.trunc(Number(displayProduct.stock_quantity || 0)))
            : undefined,
        unitOptions: [],
    };
}

export function buildSerializedProductCard(
    product: Product,
    availableUnits: Unit[],
    extraUnitOptions: PdvSerializedUnitOption[] = [],
): Extract<PdvSearchCard, { kind: 'serialized-product' }> {
    const displayProduct = stripLegacySerializedSpecs(product);
    const unitOptions = [
        ...availableUnits.filter(isAvailableUnit).map(buildPdvUnitOption),
        ...extraUnitOptions,
    ];
    if (unitOptions.length === 0) {
        const legacyOption = buildLegacyProductUnitOption(product);
        if (legacyOption) unitOptions.push(legacyOption);
    }
    return {
        kind: 'serialized-product',
        id: `product:${product.id}:serialized`,
        product: displayProduct,
        title: displayProduct.name,
        subtitle: displayProduct.sku ? `SKU: ${displayProduct.sku}` : 'Produto serializado',
        stockLabel: formatUnitCountLabel(unitOptions.length),
        quantityLocked: true,
        unitOptions,
    };
}

export async function buildPdvSearchCards(
    products: Product[],
    deps: PdvSearchCardDeps,
): Promise<PdvSearchCard[]> {
    const cards: PdvSearchCard[] = [];

    for (const product of products) {
        const units = product.track_inventory
            ? await deps.listUnitsByProduct(product.id).catch(() => [])
            : [];
        const availableUnits = units.filter(isAvailableUnit);
        const legacyOption = units.length === 0 ? buildLegacyProductUnitOption(product) : null;

        if (availableUnits.length > 0 || legacyOption) {
            cards.push(buildSerializedProductCard(product, availableUnits));
            continue;
        }

        // Produtos que ja possuem unidades devem ser vendidos somente por uma
        // unidade realmente disponivel. Nunca converta um IMEI vendido/reservado
        // em estoque comum nem reutilize os specs legados do produto.
        if (units.length > 0) continue;

        cards.push(buildStockProductCard(product));
    }

    return cards;
}

export function fromHydratedPdvSearchPayload(payload: HydratedPdvProduct[]): PdvSearchCard[] {
    const grouped = new Map<string, HydratedPdvProduct[]>();

    for (const entry of payload) {
        const key = getProductGroupingKey(entry.product);
        const entries = grouped.get(key) || [];
        entries.push({
            product: entry.product,
            available_units: (entry.available_units || []).filter(isAvailableUnit),
            has_unit_history: entry.has_unit_history === true,
        });
        grouped.set(key, entries);
    }

    return [...grouped.values()].flatMap((entries) => {
        const canonical = entries.find((entry) => (entry.available_units || []).filter(isAvailableUnit).length > 0) || entries[entries.length - 1];
        const availableUnits = entries.flatMap((entry) => (entry.available_units || []).filter(isAvailableUnit));
        const groupHasUnitHistory = entries.some((entry) => entry.has_unit_history === true);
        const legacyOptions = groupHasUnitHistory ? [] : entries
            .filter((entry) => entry.product.id !== canonical.product.id)
            .map((entry) => buildLegacyProductUnitOption(entry.product))
            .filter((option): option is PdvSerializedUnitOption => Boolean(option));

        const seenOptionKeys = new Set(
            availableUnits
                .map(buildPdvUnitOption)
                .flatMap((option) => getUnitIdentifierKeys(option.unitData))
        );
        const dedupedLegacyOptions = legacyOptions.filter((option) => {
            const keys = getUnitIdentifierKeys(option.unitData);
            if (keys.length === 0 || keys.some((key) => seenOptionKeys.has(key))) return false;
            keys.forEach((key) => seenOptionKeys.add(key));
            return true;
        });

        if (availableUnits.length > 0 || dedupedLegacyOptions.length > 0 || (!groupHasUnitHistory && buildLegacyProductUnitOption(canonical.product))) {
            return [buildSerializedProductCard(canonical.product, availableUnits, dedupedLegacyOptions)];
        }

        // Ha historico de unidades, mas nenhuma disponivel: o produto nao pode
        // aparecer como estoque comum, pois isso contornaria o controle de IMEI.
        if (groupHasUnitHistory) return [];
        return [buildStockProductCard(canonical.product)];
    });
}
