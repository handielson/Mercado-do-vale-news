import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, Phone, MapPin, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { customFieldsService } from '../../services/custom-fields';
import { Customer, CustomerInput, CustomerAddress } from '../../types/customer';
import { CustomField } from '../../types';
import { validateCpfCnpj, formatCpfCnpj, formatPhone, validateEmail } from '../../utils/cpfCnpjValidation';

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

    // Search CEP
    const searchCep = async (cep: string) => {
        const cleaned = cep.replace(/\D/g, '');
        if (cleaned.length !== 8) return;

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    address: {
                        ...prev.address,
                        street: data.logradouro || '',
                        neighborhood: data.bairro || '',
                        city: data.localidade || '',
                        state: data.uf || '',
                        zipCode: cleaned
                    }
                }));
            }
        } catch (err) {
            console.error('Error searching CEP:', err);
            toast.error('Erro ao buscar CEP');
        }
    };

    // Build full address for Google Maps
    const getFullAddress = () => {
        const addr = formData.address;
        if (!addr?.street || !addr?.number || !addr?.city || !addr?.state) {
            return null;
        }

        const parts = [
            addr.street,
            addr.number,
            addr.complement,
            addr.neighborhood,
            addr.city,
            addr.state,
            'Brasil'
        ].filter(Boolean);

        return parts.join(', ');
    };

    // Get Google Maps URL
    const getGoogleMapsUrl = () => {
        const fullAddress = getFullAddress();
        if (!fullAddress) return null;

        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
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
            toast.error(err.message || 'Erro ao salvar cliente');
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
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Informações Básicas</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nome / Razão Social *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Digite o nome do cliente"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tipo de Documento
                                </label>
                                <select
                                    value={documentType}
                                    onChange={(e) => {
                                        setDocumentType(e.target.value as 'CPF' | 'CNPJ');
                                        updateField('cpf_cnpj', '');
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="CPF">CPF</option>
                                    <option value="CNPJ">CNPJ</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {documentType}
                                </label>
                                <input
                                    type="text"
                                    value={formData.cpf_cnpj}
                                    onChange={(e) => updateField('cpf_cnpj', e.target.value)}
                                    onBlur={(e) => handleCpfCnpjBlur(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                                    maxLength={documentType === 'CPF' ? 14 : 18}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Status
                            </label>
                            <select
                                value={formData.is_active ? 'active' : 'inactive'}
                                onChange={(e) => updateField('is_active', e.target.value === 'active')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="active">Ativo</option>
                                <option value="inactive">Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-900">Contato</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => updateField('email', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="email@exemplo.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Telefone
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => updateField('phone', e.target.value)}
                                onBlur={(e) => updateField('phone', formatPhone(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>
                </div>

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
                                onChange={(e) => updateAddress('zipCode', e.target.value)}
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

                        <div className="relative">
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

                        <div className="col-span-3">
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
