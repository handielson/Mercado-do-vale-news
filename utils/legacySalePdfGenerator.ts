/**
 * legacySalePdfGenerator.ts
 *
 * Gera um PDF de comprovante de venda a partir dos dados do sistema legado (MV-Gestao).
 * Inclui dados únicos do aparelho: IMEI 1, IMEI 2, Serial, Modelo, Marca, RAM, Memória, Cor.
 *
 * Retorna um Blob pronto para upload no Synology.
 */

// Performance: jspdf carregado dinamicamente dentro de generateLegacySalePdf.
import type { default as JsPdfType } from 'jspdf';
type JsPdfClass = typeof JsPdfType;
import type { LegacySale, LegacyProduct, LegacyBrand } from '../services/legacyAPI';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegacyReceiptCompany {
  name: string;
  address?: string;
  phone?: string;
  cnpj?: string;
  logoBase64?: string; // base64 da logo
}

export interface LegacyReceiptItem {
  phone: LegacyProduct;
  brand?: LegacyBrand;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface LegacyReceiptData {
  sale: LegacySale;
  customerName: string;
  customerCpf: string;
  items: LegacyReceiptItem[];
  company: LegacyReceiptCompany;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtCpf(cpf: string): string {
  const c = cpf.replace(/\D/g, '');
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function mapPaymentLabel(method: string): string {
  const m = (method || '').toUpperCase();
  if (m.includes('PIX')) return 'PIX';
  if (m.includes('CRED') || m.includes('CARTAO') || m.includes('CARD')) return 'Cartão de Crédito';
  if (m.includes('DEB')) return 'Cartão de Débito';
  if (m.includes('DINHEIRO') || m.includes('MONEY') || m.includes('CASH')) return 'Dinheiro';
  return method || 'Não informado';
}

function mapConditionLabel(condition: string): string {
  const c = (condition || '').toUpperCase();
  if (c === 'NEW') return 'Novo';
  if (c === 'USED') return 'Usado';
  if (c === 'SHOWCASE') return 'Vitrine';
  return condition || '-';
}

// ─── Gerador principal ────────────────────────────────────────────────────────

/**
 * Gera o PDF de comprovante de venda legado.
 * Retorna um Blob com o arquivo PDF gerado.
 */
export async function generateLegacySalePdf(data: LegacyReceiptData): Promise<Blob> {
  const { sale, customerName, customerCpf, items, company } = data;

  // Lazy load jspdf — só baixa quando o usuário pede o comprovante.
  const { default: JsPDF } = (await import('jspdf')) as { default: JsPdfClass };
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 15;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 15;

  // ── Cores e fontes ──────────────────────────────────────────────────────────
  const COLOR_PRIMARY  = [30, 58, 138] as [number, number, number];   // azul escuro
  const COLOR_DARK     = [30, 30, 30]  as [number, number, number];
  const COLOR_MID      = [100, 116, 139] as [number, number, number]; // slate-500
  const COLOR_LIGHT    = [241, 245, 249] as [number, number, number]; // slate-100
  const COLOR_LINE     = [203, 213, 225] as [number, number, number]; // slate-300

  // ── Logo ────────────────────────────────────────────────────────────────────
  if (company.logoBase64) {
    try {
      doc.addImage(company.logoBase64, 'JPEG', MARGIN, y, 35, 18, undefined, 'FAST');
    } catch {
      // Logo inválida — ignora
    }
    y += 20;
  }

  // ── Cabeçalho empresa ───────────────────────────────────────────────────────
  const headerX = company.logoBase64 ? MARGIN + 40 : MARGIN;
  const headerY = company.logoBase64 ? y - 20 : y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(company.name.toUpperCase(), headerX, headerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_MID);
  if (company.address) doc.text(company.address, headerX, headerY + 5);
  const contactLine = [company.phone, company.cnpj ? `CNPJ: ${company.cnpj}` : ''].filter(Boolean).join('  |  ');
  if (contactLine) doc.text(contactLine, headerX, headerY + 10);

  y = Math.max(y, headerY + 16);

  // ── Linha separadora ────────────────────────────────────────────────────────
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  // ── Título ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('COMPROVANTE DE VENDA', PAGE_W / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MID);
  const saleId = `Nº ${sale.id.slice(0, 8).toUpperCase()}`;
  const saleDate = `Data: ${fmtDate(sale.sale_date)}`;
  doc.text(`${saleId}   ${saleDate}`, PAGE_W / 2, y, { align: 'center' });
  y += 7;

  // ── Seção: Dados do Cliente ─────────────────────────────────────────────────
  doc.setFillColor(...COLOR_LIGHT);
  doc.roundedRect(MARGIN, y, CONTENT_W, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('DADOS DO CLIENTE', MARGIN + 3, y + 4.2);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_DARK);
  doc.text(`Nome: ${customerName}`, MARGIN + 3, y);
  doc.text(`CPF: ${fmtCpf(customerCpf)}`, MARGIN + 3, y + 5);
  y += 12;

  // ── Seção: Produto(s) ────────────────────────────────────────────────────────
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const phone = item.phone;
    const brand = item.brand;

    const sectionTitle = items.length > 1
      ? `PRODUTO ${idx + 1} DE ${items.length}`
      : 'DADOS DO PRODUTO';

    doc.setFillColor(...COLOR_PRIMARY);
    doc.roundedRect(MARGIN, y, CONTENT_W, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(sectionTitle, MARGIN + 3, y + 4.2);
    y += 8;

    // Tabela de dados do produto
    const productFields: [string, string][] = [
      ['Modelo',    `${phone.model}${phone.version ? ` ${phone.version}` : ''}`],
      ['Marca',     brand?.name || phone.brand_id || '-'],
      ['Condição',  mapConditionLabel(phone.condition)],
      ['Cor',       phone.color || '-'],
      ['RAM',       phone.ram || '-'],
      ['Memória',   phone.storage || '-'],
      ['IMEI 1',    phone.imei1 || '-'],
      ['IMEI 2',    phone.imei2 || '-'],
      ['Serial',    phone.serial || '-'],
    ].filter(([, v]) => v !== '-');

    // Renderiza em 2 colunas
    const colW = CONTENT_W / 2;
    const left  = productFields.filter((_, i) => i % 2 === 0);
    const right = productFields.filter((_, i) => i % 2 === 1);
    const rows  = Math.max(left.length, right.length);

    for (let r = 0; r < rows; r++) {
      const rowY = y + r * 6;
      // Fundo alternado
      if (r % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN, rowY - 1, CONTENT_W, 6, 'F');
      }

      if (left[r]) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_MID);
        doc.text(left[r][0], MARGIN + 3, rowY + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLOR_DARK);
        doc.text(left[r][1], MARGIN + 28, rowY + 3.5);
      }
      if (right[r]) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_MID);
        doc.text(right[r][0], MARGIN + colW + 3, rowY + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLOR_DARK);
        doc.text(right[r][1], MARGIN + colW + 28, rowY + 3.5);
      }
    }
    y += rows * 6 + 4;

    // Valor do item (se mais de 1 produto)
    if (items.length > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_DARK);
      doc.text(`Valor: ${fmtBRL(item.unit_price)}`, PAGE_W - MARGIN, y - 2, { align: 'right' });
      y += 2;
    }

    y += 4;
  }

  // ── Seção: Pagamento e Total ─────────────────────────────────────────────────
  doc.setFillColor(...COLOR_LIGHT);
  doc.roundedRect(MARGIN, y, CONTENT_W, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('PAGAMENTO', MARGIN + 3, y + 4.2);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_DARK);
  doc.text(`Forma de Pagamento: ${mapPaymentLabel(sale.payment_method || '')}`, MARGIN + 3, y);
  y += 6;

  // Total em destaque
  doc.setFillColor(...COLOR_PRIMARY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL:', MARGIN + 5, y + 6.5);
  doc.text(fmtBRL(sale.total_amount || 0), PAGE_W - MARGIN - 5, y + 6.5, { align: 'right' });
  y += 15;

  // ── Garantia ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(...COLOR_LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MID);
  const garantiaText = 'Garantia legal de 90 dias contra defeitos de fabricação (Lei 8.078/1990 — CDC).';
  doc.text(garantiaText, PAGE_W / 2, y, { align: 'center' });
  y += 4;
  doc.text('Conserve este documento. Em caso de dúvidas, entre em contato com nossa loja.', PAGE_W / 2, y, { align: 'center' });

  // ── Rodapé ───────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  const footerY = 285;
  doc.text(
    `${company.name}  ·  Documento gerado em ${new Date().toLocaleDateString('pt-BR')}  ·  Ref: ${sale.id.slice(0, 8).toUpperCase()}`,
    PAGE_W / 2, footerY, { align: 'center' }
  );

  return doc.output('blob');
}
