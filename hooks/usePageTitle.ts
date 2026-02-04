import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook para atualizar o título da página dinamicamente
 * baseado na rota atual
 * 
 * @param pageTitle - Título específico da página (ex: "Produtos", "Clientes")
 * @param companyName - Nome da empresa (opcional, padrão: "Mercado do Vale")
 * 
 * @example
 * usePageTitle('Produtos');
 * // Resultado: "Mercado do Vale - Produtos"
 */
export const usePageTitle = (pageTitle?: string, companyName: string = 'Mercado do Vale') => {
    const location = useLocation();

    useEffect(() => {
        // Se pageTitle foi fornecido, usar ele
        if (pageTitle) {
            document.title = `${companyName} - ${pageTitle}`;
            return;
        }

        // Caso contrário, tentar inferir da rota
        const title = getPageTitleFromRoute(location.pathname);
        document.title = `${companyName}${title ? ` - ${title}` : ''}`;
    }, [pageTitle, companyName, location.pathname]);
};

/**
 * Mapeia rotas para títulos de página
 */
const getPageTitleFromRoute = (pathname: string): string => {
    const routeTitleMap: Record<string, string> = {
        '/admin': 'Dashboard',
        '/admin/products': 'Produtos',
        '/admin/products/new': 'Novo Produto',
        '/admin/products/bulk': 'Cadastro em Massa',
        '/admin/inventory': 'Estoque',
        '/admin/customers': 'Clientes',
        '/admin/customers/new': 'Novo Cliente',
        '/admin/team': 'Equipe',
        '/admin/team/new': 'Novo Membro',
        '/admin/pdv': 'PDV',
        '/admin/sales': 'Vendas',
        '/admin/settings/categories': 'Categorias',
        '/admin/settings/brands': 'Marcas',
        '/admin/settings/models': 'Modelos',
        '/admin/settings/colors': 'Cores',
        '/admin/settings/storages': 'Armazenamentos',
        '/admin/settings/rams': 'Memórias RAM',
        '/admin/settings/versions': 'Versões',
        '/admin/settings/battery-healths': 'Saúde da Bateria',
        '/admin/settings/fields': 'Campos Personalizados',
        '/admin/settings/payment-fees': 'Taxas de Pagamento',
        '/admin/settings/company': 'Dados da Empresa',
        '/admin/settings/custom-fields': 'Biblioteca de Campos',
        '/admin/governance': 'Governança',
        '/admin/dev-diary': 'Diário de Desenvolvimento',
        '/test-tabs': 'Teste de Abas',
        '/store': 'Loja',
        '/login': 'Login'
    };

    // Tentar match exato primeiro
    if (routeTitleMap[pathname]) {
        return routeTitleMap[pathname];
    }

    // Tentar match parcial para rotas dinâmicas (ex: /admin/products/123)
    for (const [route, title] of Object.entries(routeTitleMap)) {
        if (pathname.startsWith(route) && route !== '/admin') {
            // Se for uma rota de edição, adicionar "Editar"
            if (pathname.includes('/edit')) {
                return `Editar ${title}`;
            }
            // Se for uma rota de detalhes (apenas ID), adicionar "Detalhes"
            if (pathname.match(/\/\d+$/)) {
                return `Detalhes - ${title}`;
            }
            return title;
        }
    }

    return 'Sistema de Gestão';
};
