import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Product } from '@/types/product';
import type { CustomerType } from './catalogMessageGenerator';
import { formatPrice } from '@/services/installmentCalculator';

interface CompanySettings {
    name: string;
    phone: string;
    email: string;
    address: string;
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
            return product.price_resale || product.price_wholesale || product.price_retail;
        default:
            return product.price_retail;
    }
}

/**
 * Calculate installment (10x with 16% interest)
 */
function calculateInstallment(price: number): { value: number; total: number } {
    const installments = 10;
    const interestRate = 0.16;
    const total = price * (1 + interestRate);
    const value = total / installments;
    return { value, total };
}

/**
 * Group products by variant
 */
function groupProducts(products: Product[], customerType: CustomerType): GroupedProduct[] {
    const grouped = new Map<string, GroupedProduct>();

    products.forEach(product => {
        const cleanName = product.name.replace(/,?\s*\d+GB\/\d+GB\s*$/i, '').trim();
        const ram = product.specs?.ram || 'N/A';
        const storage = product.specs?.storage || 'N/A';
        const color = product.specs?.color || 'Sem cor';
        const variant = `${ram}/${storage}`;
        const key = `${product.model || cleanName}-${variant}`;

        const price = getPriceForCustomer(product, customerType);
        const installment = calculateInstallment(price);

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
                priceRetail: price,
                priceInstallment: installment.value,
                installmentTotal: installment.total,
                imageUrl: product.image_url || product.images?.[0] // Add product image
            });
        }
    });

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch company settings
 */
async function getCompanySettings(): Promise<CompanySettings> {
    try {
        const { supabase } = await import('@/services/supabase');
        const { data } = await supabase
            .from('company_settings')
            .select('name, phone, email, address, receipt_logo_url')
            .single();

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
    // Create PDF
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Get company settings
    const company = await getCompanySettings();

    // Group products
    const grouped = groupProducts(products, customerType);

    // Debug logging
    console.log('PDF Generation - Customer Type:', customerType);
    console.log('PDF Generation - First product price:', grouped[0]?.priceRetail);

    // Colors
    const primaryColor: [number, number, number] = [37, 99, 235]; // Blue-600
    const accentColor: [number, number, number] = [59, 130, 246]; // Blue-500
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
        await addHeader();
    };

    // Helper function to check if we need a new page
    const checkPageBreak = (requiredSpace: number) => {
        if (currentY + requiredSpace > pageHeight - 20) {
            addNewPage();
            return true;
        }
        return false;
    };

    // Header function
    const addHeader = async () => {
        // Gradient-like header background
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 45, 'F');

        doc.setFillColor(...accentColor);
        doc.rect(0, 45, pageWidth, 3, 'F');

        // Company logo (if available)
        const logoSize = 20;
        const logoX = margin + 5;
        const logoY = 12;

        let hasLogo = false;
        if (company.receipt_logo_url) {
            try {
                const logoBase64 = await loadImageAsBase64(company.receipt_logo_url);
                if (logoBase64) {
                    doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
                    hasLogo = true;
                }
            } catch (error) {
                console.error('Error loading logo:', error);
            }
        }

        // Company name
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(company.name, hasLogo ? logoX + logoSize + 5 : margin, 18);

        // Catalog title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const title = categoryName ? `Catálogo - ${categoryName}` : 'Catálogo Completo de Produtos';
        doc.text(title, hasLogo ? logoX + logoSize + 5 : margin, 28);

        // Customer type badge
        const badgeX = hasLogo ? logoX + logoSize + 5 : margin;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(badgeX, 32, 35, 7, 2, 2, 'F');
        doc.setTextColor(...primaryColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`${getCustomerTypeLabel(customerType)}`, badgeX + 2, 36.5);

        // Date
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${new Date().toLocaleDateString('pt-BR')}`, company.logo_url ? 82 : margin + 37, 36.5);

        // Company info (right side)
        doc.setFontSize(8);
        const rightX = pageWidth - margin;
        let infoY = 15;

        if (company.phone) {
            doc.text(`Tel: ${company.phone}`, rightX, infoY, { align: 'right' });
            infoY += 5;
        }
        if (company.email) {
            doc.text(company.email, rightX, infoY, { align: 'right' });
            infoY += 5;
        }
        if (company.address) {
            doc.setFontSize(7);
            doc.text(company.address, rightX, infoY, { align: 'right' });
        }

        currentY = 53;
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
    await addHeader();

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
        doc.text('A VISTA', priceX, priceY);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94);
        doc.text(formatPrice(item.priceRetail), priceX, priceY + 5);

        // Installment price (only for retail and resale, NOT for wholesale)
        if (customerType !== 'wholesale') {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text('10x de', priceX + 30, priceY);
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
        const { supabase } = await import('@/services/supabase');

        // Fetch category name
        const { data: category } = await supabase
            .from('categories')
            .select('name')
            .eq('id', categoryId)
            .single();

        // Fetch products
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', categoryId)
            .eq('status', 'active')
            .gt('stock_quantity', 0);

        if (!products || products.length === 0) {
            throw new Error('Nenhum produto disponível nesta categoria');
        }

        await generateCatalogPDF(products, customerType, category?.name);
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
        const { supabase } = await import('@/services/supabase');

        // Fetch all active products
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .gt('stock_quantity', 0);

        if (!products || products.length === 0) {
            throw new Error('Nenhum produto disponível no catálogo');
        }

        await generateCatalogPDF(products, customerType);
    } catch (error) {
        console.error('Error generating full catalog PDF:', error);
        throw error;
    }
}
