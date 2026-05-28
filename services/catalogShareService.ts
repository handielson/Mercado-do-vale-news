import { supabase } from './supabase';
import type { ShareOptions, CatalogProduct } from '@/types/catalog';
import { catalogService } from './catalogService';
import { toast } from 'sonner';

export const catalogShareService = {
    /**
     * Gerar texto formatado do catálogo
     */
    generateCatalogText: async (options: ShareOptions): Promise<string> => {
        let products: CatalogProduct[] = [];

        // Buscar produtos baseado no escopo
        if (options.scope === 'full') {
            const result = await catalogService.getProducts({}, 1, 1000);
            products = result.products;
        } else if (options.scope === 'category' && options.scopeValue) {
            products = await catalogService.getProductsByCategory(options.scopeValue);
        } else if (options.scope === 'product' && options.scopeValue) {
            const product = await catalogService.getProductById(options.scopeValue);
            products = product ? [product] : [];
        }

        // Buscar dados da empresa
        const { data: company } = await supabase
            .from('company')
            .select('name, phone, email')
            .single();

        const companyName = company?.name || 'Mercado do Vale';
        const companyPhone = company?.phone || '';

        // Formatar texto
        let text = `🛍️ *${companyName}* - Catálogo Digital\n\n`;

        if (options.scope === 'category') {
            text += `📱 *Categoria: ${options.scopeValue}*\n\n`;
        }

        products.forEach((product, index) => {
            text += `${index + 1}. *${product.name}*\n`;
            text += `   💰 ${formatCurrency(product.price_retail)}\n`;

            if (product.discount_percentage && product.discount_percentage > 0) {
                text += `   🏷️ ${product.discount_percentage}% OFF\n`;
            }

            text += `   📦 ${(product.stock_quantity ?? 0) > 0 ? 'Em estoque' : 'Sob consulta'}\n`;
            text += `   🔗 ${window.location.origin}/catalog/${product.id}\n\n`;
        });

        text += `\n📞 Entre em contato: ${companyPhone}\n`;
        text += `🌐 Veja mais: ${window.location.origin}/catalog`;

        return text;
    },

    /**
     * Compartilhar via WhatsApp
     */
    shareViaWhatsApp: async (options: ShareOptions): Promise<void> => {
        try {
            const text = await catalogShareService.generateCatalogText(options);

            const { data: company } = await supabase
                .from('company')
                .select('phone')
                .single();

            const companyPhone = company?.phone?.replace(/\D/g, '') || '';
            const url = `https://wa.me/${companyPhone}?text=${encodeURIComponent(text)}`;

            window.open(url, '_blank');

            // Rastrear compartilhamento
            await catalogShareService.trackShare('whatsapp', options.scope, options.scopeValue);

            toast.success('Abrindo WhatsApp...');
        } catch (error) {
            console.error('Erro ao compartilhar via WhatsApp:', error);
            toast.error('Erro ao compartilhar via WhatsApp');
        }
    },

    /**
     * Copiar para área de transferência
     */
    copyToClipboard: async (options: ShareOptions): Promise<void> => {
        try {
            const text = await catalogShareService.generateCatalogText(options);

            await navigator.clipboard.writeText(text);

            // Rastrear cópia
            await catalogShareService.trackShare('copy', options.scope, options.scopeValue);

            toast.success('Catálogo copiado para área de transferência!');
        } catch (error) {
            console.error('Erro ao copiar:', error);
            toast.error('Erro ao copiar catálogo');
        }
    },

    /**
     * Gerar PDF do catálogo
     */
    generatePDF: async (options: ShareOptions): Promise<void> => {
        try {
            let products: CatalogProduct[] = [];

            // Buscar produtos
            if (options.scope === 'full') {
                const result = await catalogService.getProducts({}, 1, 1000);
                products = result.products;
            } else if (options.scope === 'category' && options.scopeValue) {
                products = await catalogService.getProductsByCategory(options.scopeValue);
            } else if (options.scope === 'product' && options.scopeValue) {
                const product = await catalogService.getProductById(options.scopeValue);
                products = product ? [product] : [];
            }

            // Buscar dados da empresa
            const { data: company } = await supabase
                .from('company')
                .select('*')
                .single();

            // Gerar HTML para PDF
            const html = catalogShareService.generatePDFHTML(products, company, options);

            // Abrir em nova janela para impressão
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();

                // Aguardar carregamento e imprimir
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            }

            // Rastrear geração de PDF
            await catalogShareService.trackShare('pdf', options.scope, options.scopeValue);

            toast.success('Abrindo visualização para impressão...');
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast.error('Erro ao gerar PDF');
        }
    },

    /**
     * Gerar HTML para PDF
     */
    generatePDFHTML: (products: CatalogProduct[], company: any, options: ShareOptions): string => {
        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Catálogo - ${company?.name || 'Mercado do Vale'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3B82F6; padding-bottom: 20px; }
          .logo { width: 190px; max-width: 45%; max-height: 90px; object-fit: contain; object-position: center; margin-bottom: 12px; }
          .company-name { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 5px; }
          .company-info { font-size: 14px; color: #64748b; }
          .category-title { font-size: 20px; font-weight: bold; color: #3B82F6; margin: 20px 0; }
          .product { page-break-inside: avoid; margin-bottom: 20px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; }
          .product-name { font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 8px; }
          .product-price { font-size: 20px; color: #3B82F6; font-weight: bold; margin: 8px 0; }
          .product-image { max-width: 150px; float: left; margin-right: 15px; border-radius: 4px; }
          .discount-badge { background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; }
          .stock-status { font-size: 14px; color: #10b981; margin: 5px 0; }
          .out-of-stock { color: #ef4444; }
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; }
          .clearfix::after { content: ""; display: table; clear: both; }
          @media print {
            body { padding: 10px; }
            .product { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${company?.logoUrl || company?.logo || company?.receipt_logo_url ? `<img src="${company.logoUrl || company.logo || company.receipt_logo_url}" class="logo" alt="Logo" />` : ''}
          <div class="company-name">${company?.name || 'Mercado do Vale'}</div>
          <div class="company-info">
            ${company?.phone || ''} | ${company?.email || ''}
          </div>
          ${options.scope === 'category' ? `<div class="category-title">Categoria: ${options.scopeValue}</div>` : ''}
        </div>

        ${products.map(product => `
          <div class="product clearfix">
            ${(product.images && product.images.length > 0) ? `<img src="${product.images[0]}" class="product-image" alt="${product.name}" />` : ''}
            <div>
              <div class="product-name">${product.name}</div>
              <div class="product-price">
                ${formatCurrency(product.price_retail)}
                ${product.discount_percentage && product.discount_percentage > 0 ?
                `<span class="discount-badge">${product.discount_percentage}% OFF</span>` : ''}
              </div>
              ${product.description ? `<p style="margin: 8px 0; color: #64748b;">${product.description}</p>` : ''}
              <div class="stock-status ${(product.stock_quantity ?? 0) > 0 ? '' : 'out-of-stock'}">
                ${(product.stock_quantity ?? 0) > 0 ? `✓ Em estoque (${product.stock_quantity} unidades)` : '✗ Sob consulta'}
              </div>
            </div>
          </div>
        `).join('')}

        <div class="footer">
          <p style="font-size: 14px; margin-bottom: 5px;">📞 Entre em contato: ${company?.phone || ''}</p>
          <p style="font-size: 14px;">🌐 ${window.location.origin}/catalog</p>
        </div>
      </body>
      </html>
    `;
    },

    /**
     * Rastrear compartilhamento
     */
    trackShare: async (
        type: 'whatsapp' | 'copy' | 'pdf',
        scope: 'full' | 'category' | 'product',
        scopeValue?: string
    ): Promise<void> => {
        const sessionId = localStorage.getItem('session_id') || crypto.randomUUID();
        localStorage.setItem('session_id', sessionId);

        await supabase.from('catalog_shares').insert({
            share_type: type,
            scope,
            scope_value: scopeValue,
            session_id: sessionId
        });
    }
};

// Função auxiliar para formatar moeda
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}
