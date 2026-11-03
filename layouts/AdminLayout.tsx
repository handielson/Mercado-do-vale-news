import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Settings, Store, Users, ClipboardList, LogOut, Package, Tags, Shield, BadgeCheck, Smartphone, Palette, HardDrive, MemoryStick, GitBranch, BatteryCharging, FileText, BookOpen, CreditCard, ShoppingCart, Image, Database, Truck, MessageCircle, Ticket, Coins, Bot, Megaphone, Tag, MessageSquareDashed, Link2, Globe, Banknote, Search, Star, Activity, Server, Heart, Barcode, Boxes, Printer, Mail, DatabaseBackup, QrCode, AlertTriangle, Wrench, PanelLeftClose, PanelLeftOpen, Menu as MenuIcon, X, Camera, ChevronDown, FilePenLine, Warehouse, ListChecks, BadgePercent, Wallet, ShieldCheck, Percent, Layers, ShoppingBasket, Music2, Handshake, Send, Landmark, UserCog, Calculator, Tv, Cloud, CloudCog } from 'lucide-react';

import { useVpsAuth } from '../contexts/VpsAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/cn';
import { usePageTitle } from '../hooks/usePageTitle';
import { vpsClient } from '../services/vpsClient';
import { computeFrequentMenuItems } from '../services/adminMenuFrequent.mjs';
import { companyFiscalService, type FiscalCertificateStatus } from '../services/companyFiscalService';
import { SaleAlerts } from '../components/admin/SaleAlerts';

function isLikelyCredentialAutofill(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type AppVersionInfo = {
  version: string;
  date?: string;
  release_vps?: string;
  summary?: string;
};

type BotHealth = {
  status: 'checking' | 'online' | 'offline';
  consecutiveFailures: number;
  checkedAt: string | null;
  incidentStartedAt: string | null;
  lastError: string | null;
};

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, customer, signOut } = useVpsAuth();
  const { settings } = useTheme();
  const location = useLocation();
  const isPrint3dArea = location.pathname.startsWith('/admin/loja-3d/') || /^\/admin\/products\/print3d-(cost|production)$/.test(location.pathname);
  const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

  const [search, setSearch] = useState('');
  // admin-mobile-shortcuts-keyboard-v1: esconde o rodape de atalhos enquanto um campo de texto esta em foco.
  const [mobileKeyboardOpen, setMobileKeyboardOpen] = useState(false);
  useEffect(() => {
    const isTextField = (element: Element | null) => {
      if (!element) return false;
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
      if ((element as HTMLElement).isContentEditable) return true;
      return element instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes(element.type);
    };
    const update = () => setMobileKeyboardOpen(isTextField(document.activeElement));
    const onFocusOut = () => window.setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = window.localStorage.getItem('mdv-admin-sidebar-collapsed');
      return saved === null ? location.pathname.startsWith('/admin/settings/models') : saved === 'true';
    } catch {
      return location.pathname.startsWith('/admin/settings/models');
    }
  });
  const [appVersion, setAppVersion] = useState<AppVersionInfo | null>(null);
  const [botHealth, setBotHealth] = useState<BotHealth | null>(null);
  const [certificateAlerts, setCertificateAlerts] = useState<Array<FiscalCertificateStatus & { companyId: string; companyName: string }>>([]);
  const [certificatePopupOpen, setCertificatePopupOpen] = useState(false);
  // Celular: menu em gaveta (abaixo de md). No computador nada muda.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const mobileMenuHistory = useRef(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const result = await companyFiscalService.certificateAlerts();
        if (!active) return;
        setCertificateAlerts(result.alerts);
        const today = new Date().toISOString().slice(0, 10);
        const fingerprint = result.alerts.map(item => `${item.companyId}:${item.validUntil}`).join('|');
        if (fingerprint && sessionStorage.getItem('mdv-certificate-alert-dismissed') !== `${today}:${fingerprint}`) setCertificatePopupOpen(true);
      } catch { /* Fiscal registration may be disabled or not yet migrated. */ }
    };
    void check();
    const timer = window.setInterval(check, 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  usePageTitle();

  useEffect(() => {
    let isMounted = true;
    fetch('/VERSION.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((versionInfo) => {
        if (isMounted && versionInfo?.version) setAppVersion(versionInfo);
      })
      .catch(() => {
        if (isMounted) setAppVersion(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (isPrint3dArea) { setBotHealth(null); return; }
    const refresh = async () => {
      try {
        const status = await vpsClient.get<BotHealth>('/admin/bot-health');
        if (active) setBotHealth(status);
      } catch {
        // A indisponibilidade total da API ja aparece nas telas que dependem dela.
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isPrint3dArea]);

  function handleMenuSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextSearch = event.target.value;
    setSearch(isLikelyCredentialAutofill(nextSearch) ? '' : nextSearch);
  }

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (next) setSearch('');
    try { window.localStorage.setItem('mdv-admin-sidebar-collapsed', String(next)); } catch { /* Storage may be unavailable. */ }
  }

  const menuGroups = useMemo(() => [
    {
      title: 'Vendas & Atendimento',
      items: [
        { to: '/admin', icon: <LayoutDashboard size={18} />, label: 'Dashboard', keywords: 'inicio home painel' },
        { to: '/admin/pdv', icon: <ShoppingCart size={18} />, label: 'PDV', keywords: 'caixa venda rapida balcao' },
        { to: '/admin/sales', icon: <ShoppingBag size={18} />, label: 'Vendas', keywords: 'pedidos transacoes' },
        { to: '/admin/pedidos-online', icon: <Globe size={18} />, label: 'Pedidos Online', keywords: 'site web' },
        { to: '/admin/solicitacoes-prazo', icon: <MessageCircle size={18} />, label: 'Solicitações de prazo', keywords: 'encomenda quantidade prazo consulta whatsapp' },
        { to: '/admin/customers', icon: <Users size={18} />, label: 'Clientes', keywords: 'usuarios compradores' },
      ]
    },
    {
      title: '3DMV',
      items: [
        { to: '/admin/loja-3d/clientes', icon: <Users size={18} />, label: 'Clientes 3D', keywords: 'contas cadastro email whatsapp' },
        { to: '/admin/loja-3d/pedidos', icon: <ShoppingBag size={18} />, label: 'Pedidos 3D', keywords: 'encomendas entrada saldo pagamento' },
        { to: '/admin/loja-3d/solicitacoes', icon: <MessageCircle size={18} />, label: 'Solicitações 3D', keywords: 'encomenda quantidade prazo consulta whatsapp' },
        { to: '/admin/loja-3d/producao', icon: <Printer size={18} />, label: 'Produção 3D', keywords: 'ordens fila progresso lotes aprovadas rejeitadas' },
        { to: '/admin/loja-3d/calculadora', icon: <Printer size={18} />, label: 'Produtos e arquivos 3D', keywords: 'filamento impressao custo energia insumos arquivos ficha makerworld stl 3mf gcode' },
        { to: '/admin/loja-3d/filamentos', icon: <Boxes size={18} />, label: 'Filamentos e estoque', keywords: 'marca material cor rolo custo kg gramas entrada ajuste saldo historico' },
        { to: '/admin/loja-3d/catalogo', icon: <Store size={18} />, label: 'Catálogo e preços 3D', keywords: 'produtos publicar visibilidade oferta' },
        { to: '/admin/loja-3d/banners', icon: <Image size={18} />, label: 'Banners 3D', keywords: 'imagens carrossel' },
        { to: '/admin/loja-3d/configuracoes', icon: <Wrench size={18} />, label: 'Configurações 3DMV', keywords: 'manutencao abrir fechar site mensagem' },
      ]
    },
    {
      title: 'Produtos & Estoque',
      items: [
        { to: '/admin/products', icon: <Package size={18} />, label: 'Produtos', keywords: 'catalogo itens mercadoria' },
        { to: '/admin/products/drafts', icon: <FilePenLine size={18} />, label: 'Rascunhos de anúncios', keywords: 'cadastros incompletos continuar rascunho' },
        { to: '/admin/products/storefronts', icon: <Globe size={18} />, label: 'Publicação nos sites', keywords: 'precos canais lojas publicar' },
        { to: '/admin/inventory', icon: <ClipboardList size={18} />, label: 'Estoque', keywords: 'quantidade inventario' },
        { to: '/admin/inventory/locations', icon: <Warehouse size={18} />, label: 'Locais de Estoque', keywords: 'depositos locais prateleira caixa balcao almoxarifado' },
        { to: '/admin/products/labels', icon: <Barcode size={18} />, label: 'Etiquetas', keywords: 'imprimir etiqueta codigo barras ean sku' },
        { to: '/admin/inventory/print-list', icon: <ListChecks size={18} />, label: 'Lista de Impressão', keywords: 'lista de impressao separacao caixa imprimir ean sku conferencia' },
        { to: '/admin/products/offers', icon: <BadgePercent size={18} />, label: 'Ofertas', keywords: 'kits anuncios shopee marketplace combos' },
      ]
    },
    {
      title: 'Financeiro',
      items: [
        { to: '/admin/financeiro', icon: <Banknote size={18} />, label: 'Visão financeira', keywords: 'financeiro dinheiro pagamentos taxas contas' },
        { to: '/admin/caixa', icon: <Wallet size={18} />, label: 'Caixa', keywords: 'abertura fechamento sangria suprimento pdv' },
        { to: '/admin/caixa/auditoria', icon: <ShieldCheck size={18} />, label: 'Auditoria de Caixa', keywords: 'historico retificacao reimpressao conferencia' },
        { to: '/admin/pix-avulso', icon: <QrCode size={18} />, label: 'Pix Avulso', keywords: 'pix mercado pago qr code caixa recebimento avulso' },
        { to: '/admin/contabilidade', icon: <BookOpen size={18} />, label: 'Contabilidade', keywords: 'imposto simples nacional das nfe faturamento tributavel' },
      ]
    },
    {
      title: 'Loja Online & Marketing',
      items: [
        { to: '/admin/promotions', icon: <Percent size={18} />, label: 'Promoções', keywords: 'desconto oferta' },
        { to: '/admin/coupons', icon: <Ticket size={18} />, label: 'Cupons', keywords: 'codigo desconto' },
        { to: '/admin/cashback', icon: <Coins size={18} />, label: 'Moedas do Vale', keywords: 'cashback pontos fidelidade' },
        { to: '/admin/settings/banners', icon: <Image size={18} />, label: 'Banners', keywords: 'imagens carrossel' },
        { to: '/admin/settings/marketing', icon: <Megaphone size={18} />, label: 'Gerador de Artes', keywords: 'criativos anuncios divulgacao marketing imagens produtos' },
        { to: '/admin/catalog-config', icon: <Settings size={18} />, label: 'Config. Catálogo', keywords: 'vitrine exibir' },
        { to: '/admin/avaliacoes', icon: <Star size={18} />, label: 'Avaliações', keywords: 'estrelas reviews' },
        { to: '/admin/feedbacks', icon: <MessageSquareDashed size={18} />, label: 'Fale Conosco', keywords: 'SAC contato reclamacoes' },
        { to: '/admin/relatorios/favoritos', icon: <Heart size={18} />, label: 'Ranking Favoritos', keywords: 'wishlist desejo clientes estatistica' },
        { to: '/admin/settings/seo-analyzer', icon: <Search size={18} />, label: 'Análise de SEO', keywords: 'google analise indexacao' },
        { to: '/admin/settings/seo-blacklist', icon: <Globe size={18} />, label: 'Lista Negra SEO', keywords: 'bloquear google ocultar noindex' },
      ]
    },
    {
      title: 'Catálogo Técnico',
      items: [
        { to: '/admin/settings/categories', icon: <Tags size={18} />, label: 'Categorias', keywords: 'departamentos sessoes' },
        { to: '/admin/settings/brands', icon: <BadgeCheck size={18} />, label: 'Marcas', keywords: 'fabricantes apple xiaomi' },
        { to: '/admin/settings/models', icon: <Smartphone size={18} />, label: 'Modelos', keywords: 'iphone s24' },
        { to: '/admin/settings/fields', icon: <Layers size={18} />, label: 'Campos Customizados', keywords: 'especificacoes atributos' },
        { to: '/admin/settings/system-tags', icon: <Tag size={18} />, label: 'Tags do Sistema', keywords: 'etiquetas lacrado vitrine' },
        { to: '/admin/settings/colors', icon: <Palette size={18} />, label: 'Cores', keywords: 'tinta azul preto' },
        { to: '/admin/settings/storages', icon: <HardDrive size={18} />, label: 'Armazenamento', keywords: 'capaciade gb tb' },
        { to: '/admin/settings/rams', icon: <MemoryStick size={18} />, label: 'Memória RAM', keywords: 'ram gb' },
        { to: '/admin/settings/versions', icon: <GitBranch size={18} />, label: 'Versões', keywords: 'global india china' },
        { to: '/admin/settings/battery-healths', icon: <BatteryCharging size={18} />, label: 'Saúde da Bateria', keywords: 'saude bateria porcentagem %' },
      ]
    },
    {
      title: 'Integrações',
      items: [
        { to: '/admin/settings/bling', icon: <Link2 size={18} />, label: 'Bling', keywords: 'erp integracao' },
        { to: '/admin/settings/shopee', icon: <ShoppingBasket size={18} />, label: 'Shopee', keywords: 'shopee marketplace integracao loja api' },
        { to: '/admin/settings/tiktok-shop', icon: <Music2 size={18} />, label: 'TikTok Shop', keywords: 'tiktok shop marketplace integracao loja api' },
        { to: '/admin/settings/mercado-livre', icon: <Handshake size={18} />, label: 'Mercado Livre', keywords: 'mercado livre marketplace etiqueta dce envio estoque bling' },
        { to: '/admin/settings/whatsapp', icon: <MessageCircle size={18} />, label: 'WhatsApp', keywords: 'conexao evolution atendimento contato' },
        { to: '/admin/whatsapp/novo-bot', icon: <Bot size={18} />, label: 'Novo Bot', keywords: 'n8n novo bot reset bloquear cliente fluxo memoria contexto' },
        { to: '/admin/whatsapp/mensagens', icon: <MessageSquareDashed size={18} />, label: 'Mensagens WhatsApp', keywords: 'whatsapp conversas atendimento mensagens historico humano' },
        { to: '/admin/settings/telegram', icon: <Send size={18} />, label: 'Bot do Telegram', keywords: 'automacoes bot telegram robo respostas' },
        { to: '/admin/settings/email', icon: <Mail size={18} />, label: 'E-mail', keywords: 'email templates html cadastro promocao compra' },
        { to: '/admin/settings/integrations', icon: <Landmark size={18} />, label: 'Gateways Pagamento', keywords: 'mercado pago pagar.me stripe' },
      ]
    },
    {
      title: 'Empresa',
      items: [
        { to: '/admin/settings/company', icon: <Settings size={18} />, label: 'Dados da Empresa', keywords: 'cnpj endereco horarios' },
        { to: '/admin/team', icon: <UserCog size={18} />, label: 'Equipe', keywords: 'funcionarios vendedores' },
        { to: '/admin/settings/shipping', icon: <Truck size={18} />, label: 'Frete', keywords: 'entrega correios transportadora' },
        { to: '/admin/settings/payment-fees', icon: <Calculator size={18} />, label: 'Taxas', keywords: 'juros maquina cartao' },
        { to: '/admin/settings/displays', icon: <Tv size={18} />, label: 'Displays Android', keywords: 'android tablet tv pix caixa propaganda qr code' },
        { to: '/admin/settings/documents', icon: <FileText size={18} />, label: 'Documentos', keywords: 'termos recibos' },
        { to: '/admin/settings/warranty-templates', icon: <ShieldCheck size={18} />, label: 'Garantias', keywords: 'padrao tempo meses' },
        { to: '/admin/settings/permissions', icon: <Shield size={18} />, label: 'Permissões', keywords: 'acesso regras', adminOnly: true },
      ]
    },
    {
      title: 'Sistema (técnico)',
      items: [
        { to: '/admin/settings/system-status', icon: <Activity size={18} />, label: 'Status do sistema', keywords: 'servidor vps hostinger uptime saude diagnostico whatsapp waha instagram integracoes backup nas' },
        { to: '/admin/settings/system-backup', icon: <DatabaseBackup size={18} />, label: 'Backup Sistema', keywords: 'backup restore restaurar synology vps banco agendamento' },
        { to: '/admin/settings/mysql', icon: <Database size={18} />, label: 'MySQL Explorer', keywords: 'banco dados query sql tables' },
        { to: '/admin/settings/synology-cdn', icon: <Cloud size={18} />, label: 'CDN Synology', keywords: 'arquivos imagens videos upload nas' },
        { to: '/admin/settings/synology-config', icon: <CloudCog size={18} />, label: 'Config Synology', keywords: 'tunel cloudflare runbook restaurar diagnostico' }
      ]
    }
  ], []);

  // Filtra itens com base na busca
  const [navigationLog, setNavigationLog] = useState<any[]>([]);
  useEffect(() => {
    // Sem pressa: carrega depois que a página abriu.
    const timer = window.setTimeout(() => { void loadNavigationLog().then(setNavigationLog); }, 1500);
    return () => window.clearTimeout(timer);
  }, []);
  const frequentItems = useMemo(() => {
    const allowed = menuGroups.flatMap(group => group.items).filter(item => !item.adminOnly || customer?.customer_type === 'ADMIN');
    return computeFrequentMenuItems(navigationLog, allowed, { customerId: customer?.id || null, userId: user?.id || null, limit: 6 });
  }, [navigationLog, menuGroups, customer?.id, customer?.customer_type, user?.id]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return menuGroups;
    const term = search.toLowerCase();
    
    return menuGroups.map(group => {
      const filteredItems = group.items.filter(item => 
        item.label.toLowerCase().includes(term) || 
        item.keywords.includes(term)
      );
      return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);
  }, [search, menuGroups]);

  const activeItemPath = useMemo(() => {
    const allItems = menuGroups.flatMap(group => group.items);
    const match = allItems
      .filter(item =>
        location.pathname === item.to ||
        (item.to !== '/admin' && location.pathname.startsWith(`${item.to}/`))
      )
      .sort((a, b) => b.to.length - a.to.length)[0];

    return match?.to || '';
  }, [location.pathname, menuGroups]);

  const appVersionTooltip = appVersion
    ? [
      appVersion.version,
      appVersion.date ? `Data: ${appVersion.date}` : '',
      appVersion.release_vps ? `Release: ${appVersion.release_vps}` : '',
      appVersion.summary || '',
    ].filter(Boolean).join('\n')
    : '';

  const activeItemLabel = useMemo(() => menuGroups.flatMap(group => group.items).find(item => item.to === activeItemPath)?.label || '', [menuGroups, activeItemPath]);
  const activeGroupTitle = useMemo(() => menuGroups.find(group => group.items.some(item => item.to === activeItemPath))?.title || null, [menuGroups, activeItemPath]);

  function openMobileMenu() {
    setOpenMobileGroup(activeGroupTitle);
    setMobileMenuOpen(true);
    // Entrada no historico para o botao "voltar" do celular fechar a gaveta em vez de sair da pagina.
    try { window.history.pushState({ ...(window.history.state || {}), mdvAdminMenu: true }, ''); mobileMenuHistory.current = true; } catch { mobileMenuHistory.current = false; }
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    if (mobileMenuHistory.current) {
      mobileMenuHistory.current = false;
      try { window.history.back(); } catch { /* Historico indisponivel. */ }
    }
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onPop = () => { mobileMenuHistory.current = false; setMobileMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMobileMenu(); };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    // Ao navegar (item do menu usa replace sobre a entrada da gaveta), so fecha sem voltar no historico.
    mobileMenuHistory.current = false;
    setMobileMenuOpen(false);
  }, [location.key]);

  const mobileShortcuts = [
    { to: '/admin/products', icon: <Package size={20} />, label: 'Produtos' },
    { to: '/admin/products/photo-intake', icon: <Camera size={20} />, label: 'Foto', title: 'Cadastro por foto' },
    { to: '/admin/inventory', icon: <ClipboardList size={20} />, label: 'Estoque' },
    { to: '/admin/products/labels', icon: <Barcode size={20} />, label: 'Etiquetas' },
  ];
  // Atalho mais especifico vence: /admin/products/photo-intake acende "Foto", nao "Produtos".
  const activeShortcutPath = mobileShortcuts
    .filter(shortcut => location.pathname === shortcut.to || location.pathname.startsWith(`${shortcut.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to || null;
  const activeShortcut = mobileShortcuts.find(shortcut => shortcut.to === activeShortcutPath);
  const mobileTitle = activeShortcut && activeShortcut.to.length > (activeItemPath || '').length ? (activeShortcut.title || activeShortcut.label) : (activeItemLabel || 'Painel');

  return (
    <div className={cn("min-h-screen flex flex-col md:flex-row bg-slate-50", isPrint3dArea && "print3d-admin")} data-storefront={isPrint3dArea ? 'loja_3d' : 'mercado_do_vale'} data-admin-layout-build="2026-06-14-assets-refresh">
      {!isPrint3dArea && <SaleAlerts />}
      {certificatePopupOpen && certificateAlerts.length > 0 && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4" role="presentation"><div role="alertdialog" aria-modal="true" aria-labelledby="certificate-alert-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><h2 id="certificate-alert-title" className="text-xl font-bold text-amber-900">Certificado digital próximo do vencimento</h2><p className="mt-2 text-sm text-slate-700">Revise a renovação dos certificados destas empresas:</p><ul className="mt-3 space-y-2">{certificateAlerts.map(item => <li key={item.companyId} className="rounded-lg bg-amber-50 p-3 text-sm"><strong>{item.companyName}</strong> · {item.daysRemaining! < 0 ? 'vencido' : `faltam ${item.daysRemaining} dia(s)`} · validade {new Date(item.validUntil + 'T12:00:00').toLocaleDateString('pt-BR')}</li>)}</ul><div className="mt-5 flex flex-wrap gap-3"><Link to="/admin/settings/company#fiscal" onClick={() => setCertificatePopupOpen(false)} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white">Ver certificados</Link><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => { const today = new Date().toISOString().slice(0, 10); const fingerprint = certificateAlerts.map(item => `${item.companyId}:${item.validUntil}`).join('|'); sessionStorage.setItem('mdv-certificate-alert-dismissed', `${today}:${fingerprint}`); setCertificatePopupOpen(false); }}>Lembrar na próxima sessão</button></div></div></div>}
      {DEV_MODE && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center text-sm font-bold z-[100] shadow-lg">
          🔧 MODO DESENVOLVIMENTO - Autenticação Mock Ativa
        </div>
      )}
      <header className="md:hidden sticky top-0 z-40 flex h-14 items-center gap-2 bg-slate-900 px-2 text-white shadow-md" data-admin-mobile-topbar>
        <button type="button" onClick={openMobileMenu} aria-label="Abrir menu" aria-expanded={mobileMenuOpen} className="flex h-11 w-11 flex-none items-center justify-center rounded-lg hover:bg-slate-800"><MenuIcon size={22} /></button>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{mobileTitle}</span>
      </header>
      {mobileMenuOpen && <div className="md:hidden fixed inset-0 z-40 bg-slate-950/60" onClick={closeMobileMenu} aria-hidden="true" data-admin-mobile-backdrop />}
      <aside className={cn(
        "admin-sidebar-scroll fixed inset-y-0 left-0 w-[85vw] max-w-[320px] bg-slate-900 text-white px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] space-y-3 md:space-y-4 md:p-6 md:sticky md:top-0 md:h-screen md:max-w-none md:flex-none md:translate-x-0 flex flex-col z-50 shadow-2xl overflow-y-auto transition-[width,padding,transform] duration-200",
        sidebarCollapsed ? "md:w-[72px] md:p-3" : "md:w-64",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        DEV_MODE ? "md:top-10 md:h-[calc(100vh-2.5rem)]" : ""
      )}>
        <div className={cn("px-2 pb-2", sidebarCollapsed && "md:px-0")}>
          <div className="mb-1 flex items-center justify-between md:hidden" data-mobile-menu-header><span className="text-xs font-bold uppercase tracking-widest text-slate-400">Menu</span><button type="button" onClick={closeMobileMenu} aria-label="Fechar menu" className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"><X size={22} /></button></div>
          <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} className={cn("hidden md:flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white mb-3", sidebarCollapsed ? "mx-auto" : "ml-auto")}>
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className={cn("hidden md:flex items-center gap-3", sidebarCollapsed && "md:hidden")}>
            <Link to="/" target="_blank" title="Abrir site Mercado do Vale" className="block min-w-0 hover:opacity-80 transition-opacity">
              {settings.logo_dark || settings.logo_main ? (
                <img src={settings.logo_dark || settings.logo_main} alt={settings.company_name} className="h-10 max-w-[78px] object-contain object-left" />
              ) : (
                <h1 className="text-xl font-bold tracking-tighter text-blue-400">
                  {settings.company_name}
                </h1>
              )}
            </Link>
            <Link
              to="/loja-3d"
              target="_blank"
              title="Abrir site 3DMV"
              aria-label="Abrir site 3DMV"
              data-storefront-brand="loja_3d"
              className="flex h-11 min-w-[92px] items-center justify-center gap-1.5 rounded-md border border-violet-300/70 bg-violet-500/10 px-2 text-violet-100 transition-colors hover:border-violet-200 hover:bg-violet-500/20"
            >
              <Printer size={17} className="text-violet-300" />
              <span className="text-sm font-extrabold tracking-tight">3DMV</span>
            </Link>
          </div>
          <div className={cn("hidden flex-col items-center gap-2", sidebarCollapsed && "md:flex")}>
            <Link to="/" target="_blank" title="Abrir site Mercado do Vale" aria-label="Abrir site Mercado do Vale" className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">M</Link>
            <Link to="/loja-3d" target="_blank" title="Abrir site 3DMV" aria-label="Abrir site 3DMV" className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-300/70 text-violet-200"><Printer size={18} /></Link>
          </div>
          <div className={cn("hidden md:flex items-center gap-1.5 mt-2 mb-4", sidebarCollapsed && "md:hidden")}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Painel: {customer?.customer_type || 'ADMIN'}
            </p>
          </div>
          
          <div className={cn("relative md:mt-2", sidebarCollapsed && "md:hidden")}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              name="admin-menu-search"
              placeholder="Buscar no menu..." 
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={search}
              onChange={handleMenuSearchChange}
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-base md:text-xs rounded-lg py-2.5 md:py-2 pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        <nav aria-label="Menu administrativo" className={cn("admin-sidebar-scroll space-y-0.5 md:space-y-1 flex-none md:flex-1 md:overflow-y-auto md:pr-2 md:-mr-2 pb-2 md:pb-4", sidebarCollapsed && "md:pr-0 md:mr-0")}>
          {!search.trim() && frequentItems.length > 0 && (
            <div className={cn("mb-2 md:mb-4", sidebarCollapsed && "md:hidden")} data-menu-frequent>
              <p className="px-3 pb-1.5 pt-1 text-xs font-bold uppercase tracking-widest text-amber-300/90 md:text-[10px]">Mais usados</p>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1 md:gap-0.5">
                {frequentItems.map(item => {
                  const active = activeItemPath === item.to;
                  return (
                    <Link key={item.to} to={item.to} replace={mobileMenuOpen} aria-label={item.label}
                      className={cn("flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold leading-tight md:min-h-0 md:px-3 md:text-sm",
                        active ? "bg-blue-600 text-white" : "bg-slate-800/70 text-slate-200 hover:bg-slate-800 md:bg-transparent md:text-slate-400 md:hover:text-white")}>
                      <span className={cn("shrink-0", active ? "text-white" : "text-amber-300/90")}>{item.icon}</span>
                      <span className="min-w-0 line-clamp-2">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {filteredGroups.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Nenhuma página encontrada.
            </div>
          ) : (
            filteredGroups.map((group, groupIndex) => (
              <div key={groupIndex} className={cn("mb-0.5 md:mb-4", sidebarCollapsed && "md:mb-2 md:border-t md:border-slate-800 md:pt-2")}>
                <button type="button" onClick={() => setOpenMobileGroup(current => current === group.title ? null : group.title)} aria-expanded={!!search.trim() || openMobileGroup === group.title} className="md:hidden flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-800"><span className="min-w-0">{group.title}</span><ChevronDown size={16} className={cn("shrink-0 transition-transform", (search.trim() || openMobileGroup === group.title) && "rotate-180")} /></button>
                <div className={cn("hidden md:block pt-2 pb-2 px-3 text-[10px] font-bold uppercase tracking-widest", group.title === 'Loja 3D' ? 'text-violet-200 bg-violet-500/10 rounded-lg border-l-2 border-violet-400' : 'text-slate-400 bg-transparent', sidebarCollapsed && "md:hidden")}>
                  {group.title}
                </div>
                <div className={cn(search.trim() || openMobileGroup === group.title ? "block" : "hidden", "md:block")}>
                {group.items.map((item, itemIndex) => {
                  if (item.adminOnly && customer?.customer_type !== 'ADMIN') return null;
                  
                  return (
                    <NavItem 
                      key={itemIndex}
                      to={item.to} 
                      icon={item.icon} 
                      label={item.label} 
                      active={activeItemPath === item.to} 
                      collapsed={sidebarCollapsed}
                      replace={mobileMenuOpen}
                    />
                  );
                })}
                </div>
              </div>
            ))
          )}
        </nav>

        {appVersion?.version && (
          <div
            title={appVersionTooltip}
            className={cn("hidden md:block mx-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-[10px] text-slate-400", sidebarCollapsed && "md:hidden")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold uppercase tracking-widest text-slate-500">Versao</span>
              <span className={cn("font-mono", isPrint3dArea ? "text-violet-300" : "text-blue-300")}>{appVersion.version}</span>
            </div>
            {appVersion.release_vps && (
              <p className="mt-1 truncate font-mono text-[9px] text-slate-600">
                {appVersion.release_vps.replace('/var/www/mdv-site/releases/', '')}
              </p>
            )}
          </div>
        )}

        {user && (
          <div className="pt-3 md:pt-4 border-t border-slate-800" data-menu-footer>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs md:hidden">
              <Link to="/" target="_blank" className="font-semibold text-blue-300">Abrir site</Link>
              <Link to="/loja-3d" target="_blank" className="font-semibold text-violet-300">Abrir 3DMV</Link>
              {appVersion?.version && <span className="ml-auto font-mono text-[10px] text-slate-500" title={appVersionTooltip}>{appVersion.version.replace(/^(v\d+\.\d+\.\d+).*/, '$1')}</span>}
            </div>
            <div className={cn("flex items-center gap-3 mb-1 md:mb-4 px-2", sidebarCollapsed && "md:justify-center md:px-0")}>
              <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-xs font-bold shadow-lg", isPrint3dArea ? "from-violet-500 to-violet-700" : "from-blue-500 to-blue-700")}>
                {customer?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className={cn("flex-1 overflow-hidden", sidebarCollapsed && "md:hidden")}>
                <p className="text-sm font-bold truncate leading-none text-white">{customer?.name || user?.email || 'Usuário'}</p>
                <p className="text-[10px] text-slate-500 truncate mt-1">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sair com segurança"
              aria-label="Sair com segurança"
              className={cn("w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all", sidebarCollapsed && "md:justify-center md:px-2")}
            >
              <LogOut size={16} /> <span className={cn(sidebarCollapsed && "md:hidden")}>Sair com Segurança</span>
            </button>
          </div>
        )}
      </aside>
      <main className={cn("flex-1 min-w-0 p-4 pb-24 overflow-y-auto w-full md:w-auto overflow-x-hidden", location.pathname.startsWith('/admin/settings/models') ? "md:p-6" : "md:p-10")}>
        {isPrint3dArea && <div className="mb-5 flex items-center gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3 text-violet-900"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Printer size={20} /></span><div><p className="text-sm font-bold">3DMV</p><p className="text-xs text-violet-700">Área de gestão da 3DMV · estoque central compartilhado</p></div></div>}
        {!isPrint3dArea && botHealth?.status === 'offline' && (
          <div role="alert" className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-red-600" />
              <div>
                <p className="font-bold">Bot do WhatsApp fora do ar</p>
                <p className="mt-1 text-sm">O n8n não respondeu às verificações automáticas. O atendimento pode estar interrompido.</p>
                {botHealth.checkedAt && <p className="mt-1 text-xs text-red-700">Última verificação: {new Date(botHealth.checkedAt).toLocaleString('pt-BR')}</p>}
              </div>
            </div>
          </div>
        )}
        {children}
      </main>
      {/* admin-mobile-shortcuts-keyboard-v1: com o teclado aberto o rodape fixo flutuava no meio da tela (iOS). */}
      {!mobileKeyboardOpen && <nav aria-label="Atalhos do celular" data-admin-mobile-shortcuts className="md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(15,23,42,0.08)]">
        {mobileShortcuts.map(shortcut => (
          <Link key={shortcut.to} to={shortcut.to} aria-current={activeShortcutPath === shortcut.to ? 'page' : undefined} className={cn("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", activeShortcutPath === shortcut.to ? "text-blue-600" : "text-slate-500")}>
            {shortcut.icon}<span>{shortcut.label}</span>
          </Link>
        ))}
        <button type="button" onClick={openMobileMenu} aria-label="Abrir menu completo" className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-500"><MenuIcon size={20} /><span>Menu</span></button>
      </nav>}
    </div>
  );
};

// Histórico de navegação do admin, lido uma vez por sessão para montar os "Mais usados".
let navigationLogPromise: Promise<any[]> | null = null;
const NAVIGATION_LOG_CACHE_KEY = 'mdv-admin-menu-frequent-log';
function loadNavigationLog(): Promise<any[]> {
  if (!navigationLogPromise) {
    // Guarda só o necessário (caminho e quem visitou) durante a sessão do navegador: não baixa de novo a cada página aberta.
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(NAVIGATION_LOG_CACHE_KEY) || 'null');
      if (Array.isArray(cached)) { navigationLogPromise = Promise.resolve(cached); return navigationLogPromise; }
    } catch { /* sessão indisponível */ }
    navigationLogPromise = vpsClient.get<{ items?: any[] }>('/admin/navigation-log?limit=400')
      .then(response => {
        const rows = (Array.isArray(response?.items) ? response.items : [])
          .map((row: any) => ({ pathname: row.pathname, created_at: row.created_at, customer_id: row.customer_id, user_id: row.user_id }));
        try { window.sessionStorage.setItem(NAVIGATION_LOG_CACHE_KEY, JSON.stringify(rows)); } catch { /* sem espaço */ }
        return rows;
      })
      .catch(() => { navigationLogPromise = null; return []; });
  }
  return navigationLogPromise;
}

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; active?: boolean; collapsed?: boolean; replace?: boolean }> = ({ to, icon, label, active, collapsed, replace }) => (
  <Link
    replace={replace}
    to={to}
    title={collapsed ? label : undefined}
    aria-label={label}
    className={cn(
      "flex min-h-[44px] md:min-h-0 items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
      collapsed && "md:justify-center md:px-2",
      active
        ? to.startsWith('/admin/loja-3d/') ? "bg-violet-700 text-white shadow-lg shadow-violet-700/20" : "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
        : to.startsWith('/admin/loja-3d/') ? "hover:bg-violet-500/15 text-violet-200 hover:text-white" : "hover:bg-slate-800 text-slate-400 hover:text-white"
    )}
  >
    <span className={cn("transition-transform group-hover:scale-110", active ? "text-white" : to.startsWith('/admin/loja-3d/') ? "text-violet-300 group-hover:text-violet-100" : "text-slate-500 group-hover:text-blue-400")}>
      {icon}
    </span>
    <span className={cn("font-semibold text-sm tracking-tight", collapsed && "md:hidden")}>{label}</span>
  </Link>
);
