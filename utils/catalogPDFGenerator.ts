import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product } from '@/types/product';
import type { CustomerType } from './catalogMessageGenerator';
import { calculateInstallmentFromFees, calculatePixPrice, formatPrice } from '@/services/installmentCalculator';
import { paymentFeesService, type PaymentFee } from '@/services/payment-fees';
import { vpsApiService } from '@/services/vpsApiService';
import { publicCompanySettingsService } from '@/services/publicCompanySettings';

interface CompanySettings {
    name?: string;
    company_name?: string;
    phone: string;
    email: string;
    address: string;
    cnpj?: string;
    logo?: string;
    logoUrl?: string;
    receipt_logo_url?: string;
}

interface GroupedProduct {
    name: string;
    variant: string;
    colors: string[];
    priceRetail: number;
    priceInstallment: number;
    installmentTotal: number;
    imageUrl?: string; // Add image URL
}

/**
 * Load image as base64
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error loading image:', error);
        return null;
    }
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
    if (/^data:image\/jpe?g/i.test(dataUrl)) return 'JPEG';
    if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
    return 'PNG';
}

/**
 * Get price based on customer type
 */
function getPriceForCustomer(product: Product, customerType: CustomerType): number {
    switch (customerType) {
        case 'retail':
            return product.price_retail;
        case 'wholesale':
            return product.price_wholesale || product.price_retail;
        case 'resale':
            return product.price_reseller || product.price_wholesale || product.price_retail;
        default:
            return product.price_retail;
    }
}

/**
 * Group products by variant
 */
function groupProducts(products: Product[], customerType: CustomerType, paymentFees: PaymentFee[], pixDiscountPercent: number): GroupedProduct[] {
    const grouped = new Map<string, GroupedProduct>();

    products.forEach(product => {
        const cleanName = product.name.replace(/,?\s*\d+GB\/\d+GB\s*$/i, '').trim();
        const ram = product.specs?.ram || 'N/A';
        const storage = product.specs?.storage || 'N/A';
        const color = product.specs?.color || 'Sem cor';
        const variant = `${ram}/${storage}`;
        const key = `${product.model || cleanName}-${variant}`;

        const price = getPriceForCustomer(product, customerType);
        const pixPrice = calculatePixPrice(price, pixDiscountPercent);
        const installment = calculateInstallmentFromFees(price, paymentFees, 12);

        if (grouped.has(key)) {
            const existing = grouped.get(key)!;
            if (!existing.colors.includes(color)) {
                existing.colors.push(color);
            }
        } else {
            grouped.set(key, {
                name: cleanName,
                variant,
                colors: [color],
                priceRetail: pixPrice,
                priceInstallment: installment.value,
                installmentTotal: installment.total,
                imageUrl: product.images?.[0] // Add product image
            });
        }
    });

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function hasAvailableStock(product: Product): boolean {
    return Number(product.stock_quantity || 0) > 0;
}

function filterCatalogVisibleProducts(products: Product[]): Product[] {
    return products.filter((product) => !product.hide_from_catalog);
}

function normalizeProducts(rows: unknown[] | null): Product[] {
    return filterCatalogVisibleProducts((rows || []).map((row) => row as Product)).filter(hasAvailableStock);
}

async function getCategoryName(categoryId: string): Promise<string | undefined> {
    const categories = await vpsApiService.getCategories();
    const category = (categories || []).find((item: any) => String(item.id) === String(categoryId));
    return category?.name ? String(category.name) : undefined;
}

/**
 * Fetch company settings
 */
async function getCompanySettings(): Promise<CompanySettings> {
    try {
        const data = await vpsApiService.getCompanySettings();

        return data || {
            name: 'Mercado do Vale',
            phone: '',
            email: '',
            address: ''
        };
    } catch (error) {
        console.error('Error fetching company settings:', error);
        return {
            name: 'Mercado do Vale',
            phone: '',
            email: '',
            address: ''
        };
    }
}

/**
 * Get customer type label
 */
function getCustomerTypeLabel(customerType: CustomerType): string {
    switch (customerType) {
        case 'retail':
            return 'Varejo';
        case 'wholesale':
            return 'Atacado';
        case 'resale':
            return 'Revenda';
        default:
            return 'Varejo';
    }
}

/**
 * Generate professional catalog PDF with images
 */
export async function generateCatalogPDF(
    products: Product[],
    customerType: CustomerType = 'retail',
    categoryName?: string
): Promise<void> {
    products = filterCatalogVisibleProducts(products);

    // Create PDF
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Get company settings
    const company = await getCompanySettings();

    // Group products
    const [paymentFees, publicSettings] = await Promise.all([
        paymentFeesService.list(),
        publicCompanySettingsService.get(),
    ]);
    const pixDiscountPercent = Number(publicSettings?.pix_discount_percentage || 0);
    const grouped = groupProducts(products, customerType, paymentFees, pixDiscountPercent);

    // Debug logging
    console.log('PDF Generation - Customer Type:', customerType);
    console.log('PDF Generation - First product price:', grouped[0]?.priceRetail);

    // Colors
    const primaryColor: [number, number, number] = [37, 99, 235]; // Blue-600
    const darkColor: [number, number, number] = [30, 41, 59]; // Slate-800
    const lightGray: [number, number, number] = [248, 250, 252]; // Slate-50
    const borderColor: [number, number, number] = [226, 232, 240]; // Slate-200

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let currentY = margin;

    // Helper function to add new page
    const addNewPage = async () => {
        doc.addPage();
        currentY = margin;
        await addWarrantyStyleHeader();
    };

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
        if (currentY + requiredSpace > pageHeight - 20) {
            addNewPage();
            return true;
        }
        return false;
    };

    // Header padrao A4, espelhando o cabecalho usado nos termos de garantia.
    const addWarrantyStyleHeader = async () => {
        const headerTopY = 12;
        const headerBottomY = 43;
        const logoSize = 20;
        const logoX = margin;
        const logoY = headerTopY;
        const companyName = company.company_name || company.name || 'Mercado do Vale';
        const documentTitle = categoryName ? `Catálogo - ${categoryName}` : 'Catálogo Completo de Produtos';
        const logoUrl = company.logo || company.logoUrl || company.receipt_logo_url || '';

        let hasLogo = false;
        if (logoUrl) {
            try {
                const logoBase64 = await loadImageAsBase64(logoUrl);
                if (logoBase64) {
                    doc.addImage(logoBase64, detectImageFormat(logoBase64), logoX, logoY, logoSize, logoSize);
                    hasLogo = true;
                }
            } catch (error) {
                console.error('Error loading logo:', error);
            }
        }

        const rightX = pageWidth - margin;
        const infoStartY = headerTopY + 3;

        doc.setTextColor(...darkColor);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(documentTitle.toUpperCase(), rightX, infoStartY, { align: 'right' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, rightX, infoStartY + 6, { align: 'right' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let infoY = infoStartY + 11;
        if (company.cnpj) {
            doc.text(`CNPJ: ${company.cnpj}`, rightX, infoY, { align: 'right' });
            infoY += 4;
        }
        if (company.address) {
            const addressLines = doc.splitTextToSize(company.address, 82).slice(0, 2);
            doc.text(addressLines, rightX, infoY, { align: 'right' });
            infoY += addressLines.length * 4;
        }
        const contactLine = [company.phone ? `Tel: ${company.phone}` : '', company.email || '']
            .filter(Boolean)
            .join(' | ');
        if (contactLine) {
            doc.text(contactLine, rightX, infoY, { align: 'right' });
        }

        if (!hasLogo) {
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, margin, headerTopY + 12);
        }

        doc.setDrawColor(51, 51, 51);
        doc.setLineWidth(0.5);
        doc.line(margin, headerBottomY, pageWidth - margin, headerBottomY);

        const metadataY = headerBottomY + 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text(getCustomerTypeLabel(customerType), margin, metadataY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(new Date().toLocaleDateString('pt-BR'), margin + 28, metadataY);

        const contactSummary: string[] = [];
        if (company.phone) {
            contactSummary.push(`Tel: ${company.phone}`);
        }
        if (company.email) {
            contactSummary.push(company.email);
        }
        if (contactSummary.length > 0) {
            doc.text(contactSummary.join(' | '), rightX, metadataY, { align: 'right' });
        }

        currentY = metadataY + 10;
    };

    // Footer function
    const addFooter = (pageNum: number) => {
        const footerY = pageHeight - 12;

        // Footer line
        doc.setDrawColor(...borderColor);
        doc.setLineWidth(0.5);
        doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

        // Footer text
        doc.setFontSize(8);
        doc.setTextColor(...darkColor);
        doc.text(
            `Página ${pageNum}`,
            pageWidth / 2,
            footerY,
            { align: 'center' }
        );

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(
            'Entre em contato para mais informacoes e condicoes especiais!',
            pageWidth / 2,
            footerY + 4,
            { align: 'center' }
        );
    };

    // Add first page header
    await addWarrantyStyleHeader();

    // Summary box
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 15, 3, 3, 'F');

    doc.setTextColor(...darkColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Produtos: ${grouped.length}`, margin + 5, currentY + 6);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Preços atualizados em ${new Date().toLocaleDateString('pt-BR')}`, margin + 5, currentY + 11);

    currentY += 20;

    // Products section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Produtos Disponíveis', margin, currentY);
    currentY += 8;

    // Draw products
    let pageNum = 1;

    for (const [index, item] of grouped.entries()) {
        const productHeight = 35; // Reduced height for cleaner look

        if (checkPageBreak(productHeight)) {
            pageNum++;
        }

        // Simple product row with light background
        if (index % 2 === 0) {
            doc.setFillColor(...lightGray);
            doc.rect(margin, currentY, pageWidth - 2 * margin, productHeight - 2, 'F');
        }

        // Product image (smaller, on the left)
        const imgX = margin + 3;
        const imgY = currentY + 2;
        const imgSize = 30;

        // Try to load actual product image
        if (item.imageUrl) {
            try {
                const imageBase64 = await loadImageAsBase64(item.imageUrl);
                if (imageBase64) {
                    doc.addImage(imageBase64, 'JPEG', imgX, imgY, imgSize, imgSize);
                } else {
                    // Fallback to placeholder
                    doc.setDrawColor(...borderColor);
                    doc.setLineWidth(0.2);
                    doc.rect(imgX, imgY, imgSize, imgSize, 'S');
                }
            } catch (error) {
                console.error('Error loading product image:', error);
                // Fallback to placeholder
                doc.setDrawColor(...borderColor);
                doc.setLineWidth(0.2);
                doc.rect(imgX, imgY, imgSize, imgSize, 'S');
            }
        } else {
            // No image URL - show placeholder box
            doc.setDrawColor(...borderColor);
            doc.setLineWidth(0.2);
            doc.rect(imgX, imgY, imgSize, imgSize, 'S');
        }

        // Product details (next to image)
        const detailsX = imgX + imgSize + 5;
        let detailsY = currentY + 6;

        // Product name
        doc.setTextColor(...darkColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const maxNameWidth = 80;
        const productName = doc.splitTextToSize(item.name, maxNameWidth);
        doc.text(productName, detailsX, detailsY);
        detailsY += 6;

        // Variant and Colors
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`${item.variant} | ${item.colors.join(', ')}`, detailsX, detailsY);

        // Prices (right side)
        const priceX = pageWidth - margin - 60;
        const priceY = currentY + 8;

        // Cash price (always shown)
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('A VISTA PIX', priceX, priceY);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94);
        doc.text(formatPrice(item.priceRetail), priceX, priceY + 5);

        // Installment price (only for retail and resale, NOT for wholesale)
        if (customerType !== 'wholesale') {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text('12x de', priceX + 30, priceY);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(59, 130, 246);
            doc.text(formatPrice(item.priceInstallment), priceX + 30, priceY + 5);
        }

        currentY += productHeight;
    }

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i);
    }

    // Download PDF
    const fileName = categoryName
        ? `catalogo-${categoryName.toLowerCase().replace(/\s+/g, '-')}-${new Date().getTime()}.pdf`
        : `catalogo-completo-${new Date().getTime()}.pdf`;

    doc.save(fileName);
}

/**
 * Generate PDF for specific category
 */
export async function generateCategoryPDF(
    categoryId: string,
    customerType: CustomerType = 'retail'
): Promise<void> {
    try {
        const [categoryName, productRows] = await Promise.all([
            getCategoryName(categoryId),
            vpsApiService.getProducts({ category: categoryId, status: 'active', limit: 1000, noCache: true }),
        ]);
        const products = normalizeProducts(productRows);

        if (!products || products.length === 0) {
            throw new Error('Nenhum produto disponível nesta categoria');
        }

        await generateCatalogPDF(products, customerType, categoryName);
    } catch (error) {
        console.error('Error generating category PDF:', error);
        throw error;
    }
}

/**
 * Generate full catalog PDF
 */
export async function generateFullCatalogPDF(
    customerType: CustomerType = 'retail'
): Promise<void> {
    try {
        const productRows = await vpsApiService.getProducts({ status: 'active', limit: 1000, noCache: true });
        const products = normalizeProducts(productRows);

        if (!products || products.length === 0) {
            throw new Error('Nenhum produto disponível no catálogo');
        }

        await generateCatalogPDF(products, customerType);
    } catch (error) {
        console.error('Error generating full catalog PDF:', error);
        throw error;
    }
}
