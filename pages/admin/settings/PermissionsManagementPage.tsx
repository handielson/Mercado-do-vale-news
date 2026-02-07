import React, { useState, useEffect } from 'react';
import { Shield, Save, Check, X, Info } from 'lucide-react';
import { supabase } from '../../../services/supabase';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { ClientTypes } from '../../../utils/field-standards';

interface Permission {
    id?: string;
    user_type: string;
    feature_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
}

const FEATURES = [
    { key: 'products', label: 'Produtos' },
    { key: 'customers', label: 'Clientes' },
    { key: 'sales', label: 'Vendas' },
    { key: 'pdv', label: 'PDV' },
    { key: 'reports', label: 'Relatórios' },
    { key: 'settings', label: 'Configurações' },
    { key: 'permissions', label: 'Permissões' },
    { key: 'banners', label: 'Banners' },
    { key: 'catalog', label: 'Catálogo' },
];

const USER_TYPES = [
    { key: 'varejo', label: 'Varejo' },
    { key: 'revenda', label: 'Revenda' },
    { key: 'atacado', label: 'Atacado' },
    { key: 'admin', label: 'Admin' },
];

export const PermissionsManagementPage: React.FC = () => {
    const { customer } = useSupabaseAuth();
    const [permissions, setPermissions] = useState<Permission[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_permissions')
                .select('*')
                .order('user_type, feature_key');

            if (error) throw error;
            setPermissions(data || []);
        } catch (error) {
            console.error('Error loading permissions:', error);
            alert('Erro ao carregar permissões');
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionChange = (
        userType: string,
        featureKey: string,
        permissionType: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
        value: boolean
    ) => {
        setPermissions(prev => {
            const existing = prev.find(
                p => p.user_type === userType && p.feature_key === featureKey
            );

            if (existing) {
                return prev.map(p =>
                    p.user_type === userType && p.feature_key === featureKey
                        ? { ...p, [permissionType]: value }
                        : p
                );
            } else {
                return [
                    ...prev,
                    {
                        user_type: userType,
                        feature_key: featureKey,
                        can_view: permissionType === 'can_view' ? value : false,
                        can_create: permissionType === 'can_create' ? value : false,
                        can_edit: permissionType === 'can_edit' ? value : false,
                        can_delete: permissionType === 'can_delete' ? value : false,
                    },
                ];
            }
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Delete all existing permissions
            await supabase.from('user_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

            // Insert new permissions
            const { error } = await supabase
                .from('user_permissions')
                .insert(permissions.map(({ id, ...rest }) => rest));

            if (error) throw error;

            alert('Permissões salvas com sucesso!');
            await loadPermissions();
        } catch (error) {
            console.error('Error saving permissions:', error);
            alert('Erro ao salvar permissões');
        } finally {
            setSaving(false);
        }
    };

    const getPermission = (userType: string, featureKey: string): Permission => {
        return (
            permissions.find(
                p => p.user_type === userType && p.feature_key === featureKey
            ) || {
                user_type: userType,
                feature_key: featureKey,
                can_view: false,
                can_create: false,
                can_edit: false,
                can_delete: false,
            }
        );
    };

    const isAdmin = (userType: string) => userType === 'admin';

    if (customer?.customer_type !== 'ADMIN') {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <X className="text-red-600 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-semibold text-red-900">Acesso Negado</h3>
                        <p className="text-red-700 text-sm mt-1">
                            Apenas usuários ADMIN podem acessar esta página.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Carregando permissões...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="text-blue-600" size={28} />
                    <h1 className="text-2xl font-bold text-gray-900">
                        Gerenciamento de Permissões
                    </h1>
                </div>
                <p className="text-gray-600">
                    Configure as permissões de acesso para cada tipo de usuário
                </p>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
                <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Sobre as permissões:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                        <li><strong>Visualizar (V):</strong> Permite ver a funcionalidade</li>
                        <li><strong>Criar (C):</strong> Permite criar novos registros</li>
                        <li><strong>Editar (E):</strong> Permite modificar registros existentes</li>
                        <li><strong>Deletar (D):</strong> Permite excluir registros</li>
                        <li><strong>ADMIN:</strong> Tem todas as permissões automaticamente (não editável)</li>
                    </ul>
                </div>
            </div>

            {/* Permissions Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 w-48">
                                    Funcionalidade
                                </th>
                                {USER_TYPES.map(type => (
                                    <th
                                        key={type.key}
                                        className="px-4 py-3 text-center text-sm font-semibold text-gray-900"
                                    >
                                        {type.label}
                                        <div className="text-xs font-normal text-gray-500 mt-1">
                                            V · C · E · D
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {FEATURES.map(feature => (
                                <tr key={feature.key} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {feature.label}
                                    </td>
                                    {USER_TYPES.map(type => {
                                        const perm = getPermission(type.key, feature.key);
                                        const disabled = isAdmin(type.key);

                                        return (
                                            <td key={type.key} className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* View */}
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={perm.can_view}
                                                            disabled={disabled}
                                                            onChange={e =>
                                                                handlePermissionChange(
                                                                    type.key,
                                                                    feature.key,
                                                                    'can_view',
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </label>

                                                    {/* Create */}
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={perm.can_create}
                                                            disabled={disabled}
                                                            onChange={e =>
                                                                handlePermissionChange(
                                                                    type.key,
                                                                    feature.key,
                                                                    'can_create',
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </label>

                                                    {/* Edit */}
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={perm.can_edit}
                                                            disabled={disabled}
                                                            onChange={e =>
                                                                handlePermissionChange(
                                                                    type.key,
                                                                    feature.key,
                                                                    'can_edit',
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </label>

                                                    {/* Delete */}
                                                    <label className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={perm.can_delete}
                                                            disabled={disabled}
                                                            onChange={e =>
                                                                handlePermissionChange(
                                                                    type.key,
                                                                    feature.key,
                                                                    'can_delete',
                                                                    e.target.checked
                                                                )
                                                            }
                                                            className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        />
                                                    </label>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Salvando...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Salvar Permissões
                        </>
                    )}
                </button>
            </div>

            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Legenda:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-600 rounded"></div>
                        <span className="text-gray-700">Visualizar (V)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-600 rounded"></div>
                        <span className="text-gray-700">Criar (C)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-600 rounded"></div>
                        <span className="text-gray-700">Editar (E)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-600 rounded"></div>
                        <span className="text-gray-700">Deletar (D)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermissionsManagementPage;
