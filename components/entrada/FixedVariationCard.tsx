import React from 'react';
import { categoryService } from '../../services/categories';
import { modelService } from '../../services/models';
import { productService } from '../../services/products';
import { unitService } from '../../services/units';
import { isSmartphoneModel } from '../../services/smartphoneModelSpecs.mjs';
import { readVariationSpecs, variationSpecItems } from './fixedVariationSpecs.js';

/** Variação fixa do atalho ?variacao=: a entrada vai direto para este produto (linha com product_id). */
export interface FixedVariation {
    id: string;
    name: string;
    sku: string | null;
    image: string | null;
    /** Celular: um aparelho por linha, com IMEI ou serial (mesma regra de categoria do servidor). */
    isPhone: boolean;
    /** Não é celular, mas o produto já tem unidades: entra por serial, uma por linha. */
    unitTracked: boolean;
    /** RAM (física), armazenamento e cor do produto, para conferência (fixed-variation-specs-v1). */
    specs?: { ram: string; storage: string; color: string };
}

export const PARENT_MESSAGE = 'Este é o produto pai da família. Escolha a variação (cor/memória).';
export const NOT_FOUND_MESSAGE = 'Produto não encontrado.';
/** Mesma mensagem do servidor (productRefError em services/catalogEntryServer.cjs). */
export const COMBO_MESSAGE = 'Combo/oferta não recebe estoque: dê entrada nos produtos que o compõem.';
const LOAD_ERROR = 'Não foi possível carregar a variação.';
const CATEGORY_ERROR = 'Não foi possível identificar a categoria do modelo.';

/**
 * Carrega a variação fixa. Lança Error com a mensagem para o operador quando o produto não serve
 * (não existe, é o pai da família, é combo/oferta ou a categoria não pôde ser identificada).
 */
export async function loadFixedVariation(id: string): Promise<FixedVariation> {
    let product: Record<string, unknown> | null;
    try {
        product = await productService.getById(id) as unknown as Record<string, unknown> | null;
    } catch {
        throw new Error(LOAD_ERROR);
    }
    if (!product) throw new Error(NOT_FOUND_MESSAGE);
    if (product.is_parent === true || Number(product.is_parent) === 1) throw new Error(PARENT_MESSAGE);
    if (product.is_combo === true || Number(product.is_combo) === 1 || product.offer_type) throw new Error(COMBO_MESSAGE);

    // Como no servidor: a categoria do modelo decide; sem modelo, a do produto.
    const modelId = product.model_id ? String(product.model_id) : '';
    let model: { category_id?: string | null } | null = null;
    if (modelId) {
        try {
            model = await modelService.getById(modelId) as { category_id?: string | null } | null;
        } catch {
            throw new Error(LOAD_ERROR);
        }
        if (!model) throw new Error(LOAD_ERROR);
    }
    // Com modelo, vale só a categoria do modelo (mesmo vazia), como em isPhone do servidor.
    const categoryId = (modelId ? (model?.category_id ?? null) : (product.category_id ?? null)) as string | null;
    let categoryName: string | undefined;
    if (categoryId) {
        const category = await categoryService.getById(categoryId).catch(() => undefined) as { name?: string } | null | undefined;
        if (!category) throw new Error(CATEGORY_ERROR);
        categoryName = category.name;
    }
    const isPhone = isSmartphoneModel({ category_name: categoryName });
    // Produto que não é celular mas já tem unidades continua por unidade (o servidor recusa misturar).
    // Falha de rede não pode virar "por quantidade" em silêncio: o servidor recusaria a linha.
    const unitTracked = isPhone ? false : await unitService.listByProduct(String(product.id ?? id))
        .then(list => Array.isArray(list) && list.length > 0)
        .catch(() => { throw new Error(LOAD_ERROR); });
    const images = Array.isArray(product.images) ? product.images as unknown[] : [];
    return {
        id: String(product.id ?? id),
        name: String(product.name ?? ''),
        sku: product.sku ? String(product.sku) : null,
        image: typeof images[0] === 'string' && images[0] ? images[0] as string : null,
        isPhone,
        unitTracked,
        specs: readVariationSpecs(product),
    };
}

export interface FixedVariationCardProps {
    variation: FixedVariation;
    /** Solta a variação (tira ?variacao= da URL). */
    onChange?: () => void;
}

/** RAM, armazenamento e cor em destaque; campo faltando aparece em âmbar. */
const VariationSpecs: React.FC<{ variation: FixedVariation }> = ({ variation }) => {
    const items = variationSpecItems(variation.specs, { isPhone: variation.isPhone }) as { label: string; value: string; missing: boolean }[];
    if (items.length === 0) return null;
    return (
        <dl aria-label="Configuração da variação" className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {items.map(item => (
                <div key={item.label} className="flex gap-1">
                    <dt className="text-slate-600">{item.label}:</dt>
                    <dd className={item.missing ? 'font-medium text-amber-700' : 'font-semibold text-slate-900'}>{item.value}</dd>
                </div>
            ))}
        </dl>
    );
};

export const FixedVariationCard: React.FC<FixedVariationCardProps> = ({ variation, onChange }) => (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
        {variation.image && (
            <img src={variation.image} alt="" className="h-12 w-12 flex-none rounded object-cover bg-white" />
        )}
        <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{variation.name}</p>
            {variation.sku && <p className="text-xs text-slate-600">SKU {variation.sku}</p>}
            <VariationSpecs variation={variation} />
        </div>
        {onChange && (
            <button type="button" onClick={onChange}
                className="flex-none px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50">
                Trocar
            </button>
        )}
    </div>
);

export default FixedVariationCard;
