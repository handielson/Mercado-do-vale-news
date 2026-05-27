import { supabase } from './supabase';
import { categoryService } from './categories';
import { customFieldsService, CustomField } from './custom-fields';
import { vpsApiService } from './vpsApiService';
import { encodeCSV, parseCSV } from '../utils/csv';

export class DataSyncService {
    
    // Helper: Converter HTML para estilo Mundial Markdown
    private static htmlToMarkdown(html: string): string {
        if (!html) return '';
        let md = html;
        md = md.replace(/<br\s*\/?>/gi, '\n');
        md = md.replace(/<\/p>/gi, '\n\n');
        md = md.replace(/<p[^>]*>/gi, '');
        md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '*$1*');
        md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '*$1*');
        md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_');
        md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_');
        md = md.replace(/<[^>]*>/g, '');
        return md.trim();
    }

    // Helper: Converter Markdown Mundial para HTML
    private static markdownToHtml(md: string): string {
        if (!md) return '';
        let html = md;
        html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Protege quebras de linha virando tags HTML limpas
        const paragraphs = html.split(/\n\s*\n/);
        html = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('');
        return html;
    }

    // --- Dicionários de Tradução ---
    private static HEADER_MAPPING: Record<string, string> = {
        system_id: 'ID Sistema (Deixe Vazio se Novo)',
        name: 'Nome do Modelo',
        category: 'Categoria',
        brand: 'Marca',
        condition: 'Condição',
        price_retail: 'Preço Varejo',
        price_reseller: 'Preço Revenda',
        price_wholesale: 'Preço Atacado',
        warranty_days: 'Garantia (Dias)',
        description: 'Descrição'
    };

    private static KNOWN_SPECS: Record<string, string> = {
        color: 'Cor',
        storage: 'Armazenamento',
        ram: 'Memória RAM',
        version: 'Versão',
        battery_health: 'Saúde da Bateria',
        battery_mah: 'Bateria (mAh)',
        display: 'Tela'
    };

    // --- EXPORTAÇÃO (DOWNLOAD) DINÂMICA ---
    static async generateDynamicTemplate(categoryId: string): Promise<string> {
        const category = await categoryService.getById(categoryId);
        if (!category) throw new Error("Categoria não encontrada.");
        
        const allCustomFields = await customFieldsService.list();

        const config = category.config || {};
        const activeFields: string[] = [];

        // Monta o Cabeçalho Base (Default Keys)
        const defaultKeys = [
            'system_id', 'name', 'category', 'brand', 'condition', 
            'price_retail', 'price_reseller', 'price_wholesale', 
            'warranty_days', 'description'
        ];

        // Ignorar essas chaves ao buscar campos dinâmicos no config
        const excludeFromDynamic = [
            'custom_fields', 'ean_autofill_config', 'auto_name_enabled', 
            'auto_name_template', 'auto_name_fields', 'auto_name_separator', 
            'unique_fields', 'imei1', 'imei2', 'serial', ...defaultKeys
        ];
        
        // Varre TODOS os campos ativos no config (Ex: bateria, tela, cor)
        Object.keys(config).forEach(k => {
            if (!excludeFromDynamic.includes(k)) {
                if (typeof config[k] === 'string' && config[k] !== 'off' && config[k] !== 'hidden') {
                    if (!activeFields.includes(k)) activeFields.push(k);
                }
            }
        });

        // Adiciona as Custom Fields configuradas explicitamente (legado/extensão)
        if (Array.isArray(config.custom_fields)) {
            config.custom_fields.forEach((cf: any) => {
                if (cf.key && cf.requirement !== 'off' && cf.requirement !== 'hidden') {
                    if (!excludeFromDynamic.includes(cf.key)) {
                        if (!activeFields.includes(cf.key)) activeFields.push(cf.key);
                    }
                }
            });
        }

        // Pré-carrega Dicionários para campos que são "Table Relations" (Ex: ID da Versão -> Nome "Global")
        const relationDictionaries: Record<string, { valueToLabel: Record<string, string>, labelToValue: Record<string, string>, options: string[] }> = {};
        for (const key of activeFields) {
            const cf = allCustomFields.find(f => f.key === key);
            if (cf?.field_type === 'table_relation' && cf.table_config) {
                const { table_name, value_column, label_column } = cf.table_config;
                try {
                    const { data } = await supabase.from(table_name).select(`${value_column}, ${label_column}`);
                    const vMap: Record<string, string> = {};
                    const lMap: Record<string, string> = {};
                    const optList: string[] = [];

                    if (data) {
                        data.forEach(item => {
                            const val = String(item[value_column]);
                            const lbl = String(item[label_column]);
                            vMap[val] = lbl;
                            lMap[lbl.toLowerCase()] = val;
                            optList.push(lbl);
                        });
                    }
                    relationDictionaries[key] = { valueToLabel: vMap, labelToValue: lMap, options: optList };
                } catch (e) {
                    console.error(`Erro ao mapear tabela referencial para o campo ${key}`, e);
                }
            }
        }

        // Criando a tradução dinâmica (Inserindo Opções de Lista Dropdown)
        const dynamicHeadersMap: Record<string, string> = {};
        activeFields.forEach(key => {
            const cf = allCustomFields.find(f => f.key === key);
            let label = this.KNOWN_SPECS[key] || (cf?.label) || key;
            
            // Injeta as opções disponíveis direto no cabeçalho p/ evitar erros
            if (cf?.options && cf.options.length > 0) {
                label += ` [Opções: ${cf.options.join(', ')}]`;
            } else if (relationDictionaries[key]) {
                const dictOpts = relationDictionaries[key].options;
                label += ` [Opções: ${dictOpts.slice(0, 10).join(', ')}${dictOpts.length > 10 ? ', ...' : ''}]`;
            } else if (key === 'condition') {
                label += ` [Opções: Novo, Seminovo, Usado]`; // Fixo
            }
            dynamicHeadersMap[key] = label;
        });

        // Monta os Cabeçalhos Finais
        const finalHeaderKeys = [...defaultKeys, ...activeFields];

        // Traduz tudo para Português
        const translatedHeaders = finalHeaderKeys.map(key => this.HEADER_MAPPING[key] || dynamicHeadersMap[key] || key);

        // Busca produtos pela VPS/MySQL; modelos seguem separados para evitar ambiguidade no join legado.
        const products = (await vpsApiService.getProducts({
            category: categoryId,
            status: 'all',
            limit: 5000,
            noCache: true,
        }) || []).sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));

        // Fetch de Modelos manualmente para mapear template_values e Marca (brands)
        const modelIds = [...new Set((products || []).map(p => p.model_id).filter(Boolean))];
        const modelsMap: Record<string, { template_values: any, brandName: string }> = {};

        if (modelIds.length > 0) {
            const { data: modelsData, error: modelsError } = await supabase
                .from('models')
                .select(`
                    id,
                    template_values,
                    brands (
                        name
                    )
                `)
                .in('id', modelIds);
            
            if (modelsData) {
                modelsData.forEach((m: any) => {
                    modelsMap[m.id] = {
                        template_values: m.template_values || {},
                        // Tratando array ou objeto na resposta do PostgREST
                        brandName: (Array.isArray(m.brands) ? m.brands[0]?.name : m.brands?.name) || ''
                    };
                });
            }
        }

        const rows: any[][] = [];

        // Monta o Tutorial Master Super Claro
        rows.push(["🚨 TUTORIAL DE IMPORTAÇÃO (LEIA ANTES DE PREENCHER) 🚨", "", "", "", "", "", "", ""]);
        rows.push(["[ID Sistema]: NUNCA crie IDs manuais. [Linhas Repetidas?]: A planilha mostra cada variação (Cor/Memória) numa linha separada para você poder ajustar o PREÇO de cada uma.", "", "", "", "", "", "", ""]);
        rows.push(["[Descrição]: Use *texto* para gerar Negrito e _texto_ para gerar Itálico.", "", "", "", "", "", "", ""]);
        rows.push(["[Opções]: Copie o nome exatamente como está nos colchetes do título, senão o sistema rejeita.", "", "", "", "", "", "", ""]);
        rows.push(["[Regras Base]: Varejo/Revenda/Atacado apenas números. [Marca] e [Categoria] precisam existir no painel.", "", "", "", "", "", "", ""]);
        rows.push(["", "", "", "", "", "", "", ""]);
        rows.push(["--- FIM DO TUTORIAL ---", "", "", "", "", "", "", ""]);
        rows.push(["", "", "", "", "", "", "", ""]);
        
        // Cabecalho Final
        rows.push(translatedHeaders);

        if (products && products.length > 0) {
            products.forEach(p => {
                // Mesclando as especificações: Template do Modelo + Variação do Produto
                // Isso garante que campos como "processador" e "display" preenchidos no Modelo apareçam aqui.
                const modelData = modelsMap[p.model_id] || { template_values: {}, brandName: '' };
                const specs = { ...(modelData.template_values), ...(p.specs || {}) };
                const brandName = p.brand || modelData.brandName;
                
                const dataRow = finalHeaderKeys.map(headerKey => {
                    if (headerKey === 'system_id') return p.id;
                    if (headerKey === 'name') return p.name || '';
                    if (headerKey === 'category') return category.name;
                    if (headerKey === 'brand') return brandName || '';
                    if (headerKey === 'condition') return p.condition || 'Seminovo';
                    if (headerKey === 'price_retail') return p.price_retail || '';
                    if (headerKey === 'price_reseller') return p.price_reseller || '';
                    if (headerKey === 'price_wholesale') return p.price_wholesale || '';
                    if (headerKey === 'warranty_days') return p.warranty_days || '';
                    // Descrição convertida para o Markdown Global (sem sujeira HTML)
                    if (headerKey === 'description') return this.htmlToMarkdown(p.description || '');
                    
                    // Resolvendo valores dinâmicos
                    const rawValue = specs[headerKey] || '';
                    const dictionary = relationDictionaries[headerKey];
                    // Se o campo for do tipo ID relacional, trocamos pelo NOME da opção para o CSV
                    if (dictionary && rawValue) {
                        return dictionary.valueToLabel[String(rawValue)] || rawValue;
                    }
                    
                    return rawValue;
                });
                rows.push(dataRow);
            });
        }

        // Retorna o CSV como String
        return encodeCSV(rows);
    }

    // --- IMPORTAÇÃO (UPLOAD/SYNC) ESTRITA ---
    static async syncGoogleSpreadsheet(urlOrId: string, categoryId: string) {
        // 1. Extrai o ID da Planilha se o usuário colou a URL completa
        let sheetId = urlOrId;
        const match = urlOrId.match(/\/d\/(.*?)(\/|$)/);
        if (match && match[1]) {
            sheetId = match[1];
        }

        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

        // 2. Tenta fazer Fetch. Pode ocorrer erro de CORS. Se ocorrer, precisaremos proxy ou Edge Function.
        let csvText = '';
        try {
            const response = await fetch(exportUrl);
            if (!response.ok) throw new Error("A planilha não é pública ou o link está errado.");
            csvText = await response.text();
        } catch (error) {
            throw new Error(`Erro ao acessar planilha. O Google Sheets bloqueou ou o link é inválido. Tente 'Baixar como CSV' no Google e nos avise.`);
        }

        // 3. Parse customizado
        const rows = parseCSV(csvText);

        // 4. Reconhecimento Reverso dos Cabeçalhos em PT-BR para Chaves de Banco
        const allCustomFields = await customFieldsService.list();
        
        // Reverse Translation Dictionary
        const reverseTranslation: Record<string, string> = {};
        Object.entries(this.HEADER_MAPPING).forEach(([k, v]) => { reverseTranslation[v] = k; });
        
        // Extrai as chaves reais baseada no texto do Header da planilha
        // Ex: "Memória RAM [Opções: 128GB]" -> deve voltar pra "ram"
        let headerRowIndex = -1;
        let finalHeaderKeys: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            // A linha de header sempre terá a palavra "Nome do Modelo" ou "ID Sistema (Deixe Vazio se Novo)"
            if (rows[i][0]?.includes('ID Sistema') || rows[i][1] === 'Nome do Modelo') {
                headerRowIndex = i;
                
                finalHeaderKeys = rows[i].map(headerText => {
                    if (!headerText) return '';
                    // Tenta tradução oficial de campos base
                    if (reverseTranslation[headerText]) return reverseTranslation[headerText];
                    
                    // Limpa a string de opções '[Opções: X, Y]' para tentar achar no KNOWN_SPECS reverso
                    const cleanHeader = headerText.split(' [Opções:')[0].trim();
                    
                    // Tenta achar em KNOWN_SPECS
                    const specEntry = Object.entries(this.KNOWN_SPECS).find(([k, v]) => v === cleanHeader);
                    if (specEntry) return specEntry[0];
                    
                    // Tenta achar no Custom Fields list (pelo label)
                    const cfMatch = allCustomFields.find(f => f.label === cleanHeader || f.key === cleanHeader);
                    if (cfMatch) return cfMatch.key;
                    
                    // Fallback
                    return cleanHeader;
                });
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error("Padrão inválido! Não encontramos a linha de cabeçalho. Não apague os títulos como 'Nome do Modelo'.");
        }

        const dataRows = rows.slice(headerRowIndex + 1);

        // 5. Configs
        const category = await categoryService.getById(categoryId);
        if (!category) throw new Error("Categoria não encontrada.");

        // Para os campos dinâmicos, reconstruir os Dicionários de Relacionamento para mapear String -> ID no Upload
        const relationDictionaries: Record<string, { labelToValue: Record<string, string> }> = {};
        for (const cf of allCustomFields) {
            if (cf.field_type === 'table_relation' && cf.table_config) {
                const { table_name, value_column, label_column } = cf.table_config;
                try {
                    const { data } = await supabase.from(table_name).select(`${value_column}, ${label_column}`);
                    const lMap: Record<string, string> = {};
                    if (data) {
                        data.forEach(item => {
                            lMap[String(item[label_column]).toLowerCase()] = String(item[value_column]);
                        });
                    }
                    relationDictionaries[cf.key] = { labelToValue: lMap };
                } catch (e) {
                    console.error(`Erro dicionario reverso ${cf.key}`, e);
                }
            }
        }

        const allBrands = await vpsApiService.getBrands();
        const validBrands = (allBrands ?? [])
            .map((b: any) => String(b.name || '').toLowerCase())
            .filter(Boolean);

        const results = { processed: 0, inserted: 0, updated: 0, errors: [] as string[] };

        // 6. Processamento Estrito
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowIndex = i + headerRowIndex + 2;

            if (!row[0] && !row[1] && !row[2]) continue;

            // Mapeando dados para as English DB keys
            const map: Record<string, string> = {};
            finalHeaderKeys.forEach((key, idx) => {
                if (key) map[key] = row[idx] || '';
            });

            if (!map.name) { results.errors.push(`Linha ${rowIndex}: Nome do Modelo Vazio.`); continue; }
            if (!map.brand) { results.errors.push(`Linha ${rowIndex}: Marca Vazia.`); continue; }

            if (!validBrands.includes(map.brand.toLowerCase())) {
                results.errors.push(`Linha ${rowIndex}: Marca '${map.brand}' NÃO EXISTE no sistema! Crie no painel antes.`);
                continue;
            }

            // Converter Números
            const parsePrice = (p: string) => {
                const num = parseFloat(p.replace(/[^0-9.]/g, ''));
                return isNaN(num) ? 0 : num;
            };

            const system_id = map.system_id;
            const price_retail = parsePrice(map.price_retail);
            const price_reseller = parsePrice(map.price_reseller);
            const price_wholesale = parsePrice(map.price_wholesale);
            const warranty_days = parseInt(map.warranty_days) || category.warranty_days || 90;
            
            // Build SPECS & Validate
            const specs: any = {};
            finalHeaderKeys.forEach(key => {
                const baseFields = ['system_id', 'name', 'category', 'brand', 'condition', 'price_retail', 'price_reseller', 'price_wholesale', 'warranty_days', 'description'];
                if (!baseFields.includes(key) && map[key]) {
                    const rawValue = map[key].trim();
                    const dict = relationDictionaries[key];
                    
                    // Se for um campo Table Relation (ex: versão), procuramos o ID baseado no Texto (Global -> ID 123)
                    if (dict) {
                        const resolvedId = dict.labelToValue[rawValue.toLowerCase()];
                        if (resolvedId) {
                            specs[key] = resolvedId;
                        } else {
                            results.errors.push(`Linha ${rowIndex}: '${rawValue}' não é uma opção válida para o campo '${key}'.`);
                        }
                    } else {
                        // Campo de texto livre ou select padrão
                        specs[key] = rawValue;
                    }
                }
            });

            const payload = {
                name: map.name,
                category_id: category.id,
                brand: map.brand,
                condition: map.condition || 'Seminovo',
                price_retail,
                price_reseller,
                price_wholesale,
                warranty_days,
                // Traduz o Markdown Global de volta para Formatação Rica do eCommerce
                description: this.markdownToHtml(map.description || ''),
                specs,
                slug: map.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000)
            };

            try {
                if (system_id) {
                    const { error } = await supabase.from('products').update(payload).eq('id', system_id);
                    if (error) throw error;
                    results.updated++;
                } else {
                    const { error } = await supabase.from('products').insert([payload]);
                    if (error) throw error;
                    results.inserted++;
                }
                results.processed++;
            } catch (err: any) {
                results.errors.push(`Linha ${rowIndex} (${map.name}): Erro BD - ${err.message}`);
            }
        }

        return results;
    }
}
