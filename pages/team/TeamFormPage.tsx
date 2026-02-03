import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, User, Mail, Phone, MapPin, FileText, ExternalLink, MessageCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { teamService } from '../../services/team';
import { TeamMember, TeamMemberInput, TeamMemberAddress } from '../../types/team';
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
import TeamBasicInfoSection from '../../components/team/TeamBasicInfoSection';
import TeamContactSection from '../../components/team/TeamContactSection';
import TeamRemunerationSection from '../../components/team/TeamRemunerationSection';

/**
 * Team Form Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - Form validation
 * - < 500 lines
 */
export default function TeamFormPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    // State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CPF');

    // Form data
    const [formData, setFormData] = useState<TeamMemberInput>({
        name: '',
        cpf_cnpj: '',
        email: '',
        phone: '',
        role: '',
        employment_type: '',
        address: {
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: '',
            zipCode: ''
        },
        is_active: true
    });

    // Load team member data if editing
    useEffect(() => {
        if (isEditing && id) {
            loadTeamMember(id);
        }
    }, [id]);

    const loadTeamMember = async (memberId: string) => {
        try {
            setLoading(true);
            const member = await teamService.getById(memberId);
            if (member) {
                setFormData({
                    name: member.name,
                    cpf_cnpj: member.cpf_cnpj,
                    email: member.email,
                    phone: member.phone,
                    role: member.role,
                    employment_type: member.employment_type,
                    salary: member.salary,
                    hourly_rate: member.hourly_rate,
                    commission_rate: member.commission_rate,
                    delivery_fee: member.delivery_fee,
                    address: member.address,
                    is_active: member.is_active,
                    admin_notes: member.admin_notes
                });
            }
        } catch (err) {
            console.error('Error loading team member:', err);
            toast.error('Erro ao carregar membro da equipe');
        } finally {
            setLoading(false);
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

    // Get WhatsAppUrl moved to utils/customerFormUtils.ts
    const getWhatsAppUrl = () => getWhatsAppUrlUtil(formData.phone || '', formData.name);

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.name.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }

        if (!formData.role) {
            toast.error('Cargo é obrigatório');
            return;
        }

        if (!formData.employment_type) {
            toast.error('Tipo de vínculo é obrigatório');
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
                await teamService.update(id, formData);
                toast.success('Membro da equipe atualizado com sucesso!');
            } else {
                await teamService.create(formData);
                toast.success('Membro da equipe criado com sucesso!');
            }

            navigate('/admin/team');
        } catch (err: any) {
            console.error('Error saving team member:', err);

            // Check for duplicate CPF/CNPJ error
            if (err.message?.includes('unique') ||
                err.message?.includes('duplicate key') ||
                err.code === '23505') {
                toast.error(`Este ${documentType} já está cadastrado`);
            } else {
                toast.error(err.message || 'Erro ao salvar membro da equipe');
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
    const updateAddress = (field: keyof TeamMemberAddress, value: string) => {
        setFormData({
            ...formData,
            address: {
                ...formData.address,
                [field]: value
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
                    onClick={() => navigate('/admin/team')}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {isEditing ? 'Editar Membro da Equipe' : 'Novo Membro da Equipe'}
                    </h1>
                    <p className="text-sm text-slate-600">
                        {isEditing ? 'Atualize as informações do membro' : 'Preencha os dados do novo membro'}
                    </p>
                </div>
            </div>



            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <TeamBasicInfoSection
                    formData={formData}
                    documentType={documentType}
                    onFieldUpdate={updateField}
                    onDocumentTypeChange={setDocumentType}
                />

                {/* Contact Info */}
                <TeamContactSection
                    formData={formData}
                    onFieldUpdate={updateField}
                />

                {/* Remuneration */}
                <TeamRemunerationSection
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
                        onClick={() => navigate('/admin/team')}
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
