import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, Phone, MapPin, FileText, ExternalLink, MessageCircle, Instagram, Facebook } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { customFieldsService } from '../../services/custom-fields';
import { Customer, CustomerInput, CustomerAddress } from '../../types/customer';
import { CustomField } from '../../types';
import { validateCpfCnpj, formatCpfCnpj, formatPhone, validateEmail } from '../../utils/cpfCnpjValidation';
import {
    capitalizeName,
    calculateAge,
    daysUntilBirthday,
    formatCep,
    searchCep as searchCepUtil,
    getFullAddress as getFullAddressUtil,
    getGoogleMapsUrl as getGoogleMapsUrlUtil,
    getWhatsAppUrl as getWhatsAppUrlUtil
} from '../../utils/customerFormUtils';
import CustomerBasicInfoSection from '../../components/customers/CustomerBasicInfoSection';
import CustomerContactSection from '../../components/customers/CustomerContactSection';

/**
 * Customer Form Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - Custom fields integration
 * - Form validation
 * - < 500 lines
 */
export default function CustomerFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    // State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CPF');

    // Form data
    const [formData, setFormData] = useState<CustomerInput>({
        name: '',
        cpf_cnpj: '',
        email: '',
        phone: '',
        address: {
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            zipCode: ''
        },
        custom_data: {},
        is_active: true
    });

    // Load customer data if editing
    useEffect(() => {
        if (isEditing && id) {
            loadCustomer(id);
        }
        loadCustomFields();
    }, [id]);

    const loadCustomer = async (customerId: string) => {
        try {
            setLoading(true);
            const customer = await customerService.getById(customerId);
            if (customer) {
                setFormData({
                    name: customer.name,
                    cpf_cnpj: customer.cpf_cnpj,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    custom_data: customer.custom_data,
                    is_active: customer.is_active
                });
            }
        } catch (err) {
            console.error('Error loading customer:', err);
            toast.error('Erro ao carregar cliente');
        } finally {
            setLoading(false);
        }
    };

    const loadCustomFields = async () => {
        try {
            const fields = await customFieldsService.list();
            const customerFields = fields.filter(f => f.category === 'basic');
            setCustomFields(customerFields);
        } catch (err) {
            console.error('Error loading custom fields:', err);
        }
    };

    // capitalizeName moved to utils/customerFormUtils.ts

    // Validate CPF/CNPJ on blur
    const handleCpfCnpjBlur = (value: string) => {
        if (!value) return;

        const formatted = formatCpfCnpj(value);
        updateField('cpf_cnpj', formatted);

        // Validate based on selected type
        const cleaned = value.replace(/\D/g, '');
        if (documentType === 'CPF' && cleaned.length > 0 && cleaned.length !== 11) {
            toast.error('CPF deve ter 11 dígitos');
            return;
        }
        if (documentType === 'CNPJ' && cleaned.length > 0 && cleaned.length !== 14) {
            toast.error('CNPJ deve ter 14 dígitos');
            return;
        }

        if (!validateCpfCnpj(value)) {
            toast.error(`${documentType} inválido`);
        }
    };

    // Search CEP using utility function
    const searchCep = async (cep: string) => {
        const result = await searchCepUtil(cep);
        if (result) {
            setFormData(prev => ({
                ...prev,
                address: {
                    ...prev.address,
                    ...result
                }
            }));
        } else if (cep.replace(/\D/g, '').length === 8) {
            toast.error('Erro ao buscar CEP');
        }
    };

    // getFullAddress moved to utils/customerFormUtils.ts
    const getFullAddress = () => getFullAddressUtil(formData.address || {});

    // getGoogleMapsUrl moved to utils/customerFormUtils.ts
    const getGoogleMapsUrl = () => getGoogleMapsUrlUtil(formData.address || {});

    // getWhatsAppUrl moved to utils/customerFormUtils.ts
    const getWhatsAppUrl = () => getWhatsAppUrlUtil(formData.phone || '', formData.name);

    // calculateAge moved to utils/customerFormUtils.ts

    // daysUntilBirthday moved to utils/customerFormUtils.ts

    // Get Instagram URL
    const getInstagramUrl = () => {
        if (!formData.instagram) return null;

        // Remove @ if present and any spaces
        const username = formData.instagram.replace(/[@\s]/g, '');
        if (!username) return null;

        return `https://instagram.com/${username}`;
    };

    // Get Facebook URL
    const getFacebookUrl = () => {
        if (!formData.facebook) return null;

        // Remove spaces
        const username = formData.facebook.trim();
        if (!username) return null;

        // If it's already a full URL, return it
        if (username.startsWith('http')) return username;

        // Otherwise, create URL from username
        return `https://facebook.com/${username}`;
    };

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.name.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }

        if (formData.cpf_cnpj) {
            const cleaned = formData.cpf_cnpj.replace(/\D/g, '');
            if (documentType === 'CPF' && cleaned.length !== 11) {
                toast.error('CPF deve ter 11 dígitos');
                return;
            }
            if (documentType === 'CNPJ' && cleaned.length !== 14) {
                toast.error('CNPJ deve ter 14 dígitos');
                return;
            }
            if (!validateCpfCnpj(formData.cpf_cnpj)) {
                toast.error(`${documentType} inválido`);
                return;
            }
        }

        if (formData.email && !validateEmail(formData.email)) {
            toast.error('Email inválido');
            return;
        }

        try {
            setSaving(true);

            if (isEditing && id) {
                await customerService.update(id, formData);
                toast.success('Cliente atualizado com sucesso!');
            } else {
                await customerService.create(formData);
                toast.success('Cliente criado com sucesso!');
            }

            navigate('/admin/customers');
        } catch (err: any) {
            console.error('Error saving customer:', err);

            // Check for duplicate CPF/CNPJ error
            if (err.message?.includes('unique_customer_per_company') ||
                err.message?.includes('duplicate key') ||
                err.code === '23505') {
                toast.error(`Este ${documentType} já está cadastrado para esta empresa`);
            } else {
                toast.error(err.message || 'Erro ao salvar cliente');
            }
        } finally {
            setSaving(false);
        }
    };

    // Update field
    const updateField = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    // Update address field
    const updateAddress = (field: keyof CustomerAddress, value: string) => {
        setFormData({
            ...formData,
            address: {
                ...formData.address,
                [field]: value
            }
        });
    };

    // Update custom field
    const updateCustomField = (key: string, value: any) => {
        setFormData({
            ...formData,
            custom_data: {
                ...formData.custom_data,
                [key]: value
            }
        });
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/admin/customers')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
                    </h1>
                    <p className="text-sm text-slate-600">
                        {isEditing ? 'Atualize as informações do cliente' : 'Preencha os dados do novo cliente'}
                    </p>
                </div>
            </div>



            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <CustomerBasicInfoSection
                    formData={formData}
                    documentType={documentType}
                    onFieldUpdate={updateField}
                    onDocumentTypeChange={setDocumentType}
                />

                {/* Contact Info */}
                <CustomerContactSection
                    formData={formData}
                    onFieldUpdate={updateField}
                />

                {/* Address */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Endereço</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                CEP
                            </label>
                            <input
                                type="text"
                                value={formData.address?.zipCode || ''}
                                onChange={(e) => {
                                    // Permitir apenas números e hífen, máximo 8 dígitos
                                    let value = e.target.value.replace(/[^\d-]/g, '');
                                    // Limitar a 8 dígitos (sem contar o hífen)
                                    const digitsOnly = value.replace(/-/g, '');
                                    if (digitsOnly.length > 8) {
                                        value = value.slice(0, -1);
                                    }
                                    updateAddress('zipCode', value);
                                }}
                                onBlur={(e) => searchCep(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="00000-000"
                                maxLength={9}
                            />
                        </div>

                        <div className="col-span-3">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Rua
                            </label>
                            <input
                                type="text"
                                value={formData.address?.street || ''}
                                onChange={(e) => updateAddress('street', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nome da rua"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Número
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.address?.number || ''}
                                    onChange={(e) => updateAddress('number', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="123"
                                />
                                {getGoogleMapsUrl() && (
                                    <a
                                        href={getGoogleMapsUrl()!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        title="Abrir no Google Maps"
                                    >
                                        <ExternalLink className="w-5 h-5" />
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Complemento
                            </label>
                            <input
                                type="text"
                                value={formData.address?.complement || ''}
                                onChange={(e) => updateAddress('complement', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Apto, Bloco, etc"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Bairro
                            </label>
                            <input
                                type="text"
                                value={formData.address?.neighborhood || ''}
                                onChange={(e) => updateAddress('neighborhood', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nome do bairro"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Cidade
                            </label>
                            <input
                                type="text"
                                value={formData.address?.city || ''}
                                onChange={(e) => updateAddress('city', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nome da cidade"
                            />
                        </div>

                        <div className="col-span-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Estado
                            </label>
                            <select
                                value={formData.address?.state || ''}
                                onChange={(e) => updateAddress('state', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Selecione...</option>
                                <option value="AC">Acre</option>
                                <option value="AL">Alagoas</option>
                                <option value="AP">Amapá</option>
                                <option value="AM">Amazonas</option>
                                <option value="BA">Bahia</option>
                                <option value="CE">Ceará</option>
                                <option value="DF">Distrito Federal</option>
                                <option value="ES">Espírito Santo</option>
                                <option value="GO">Goiás</option>
                                <option value="MA">Maranhão</option>
                                <option value="MT">Mato Grosso</option>
                                <option value="MS">Mato Grosso do Sul</option>
                                <option value="MG">Minas Gerais</option>
                                <option value="PA">Pará</option>
                                <option value="PB">Paraíba</option>
                                <option value="PR">Paraná</option>
                                <option value="PE">Pernambuco</option>
                                <option value="PI">Piauí</option>
                                <option value="RJ">Rio de Janeiro</option>
                                <option value="RN">Rio Grande do Norte</option>
                                <option value="RS">Rio Grande do Sul</option>
                                <option value="RO">Rondônia</option>
                                <option value="RR">Roraima</option>
                                <option value="SC">Santa Catarina</option>
                                <option value="SP">São Paulo</option>
                                <option value="SE">Sergipe</option>
                                <option value="TO">Tocantins</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Admin Notes */}
                <div className="bg-amber-50 rounded-lg shadow-sm border border-amber-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-amber-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Observações Internas</h2>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                            Apenas Admin
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Notas e Observações
                        </label>
                        <textarea
                            value={formData.admin_notes || ''}
                            onChange={(e) => updateField('admin_notes', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                            placeholder="Adicione observações internas sobre este cliente (visível apenas para administradores)..."
                            rows={4}
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            💡 Estas informações são privadas e não serão compartilhadas com o cliente
                        </p>
                    </div>
                </div>



                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/customers')}
                        className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                {isEditing ? 'Atualizar' : 'Salvar'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
