import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { customerService } from '../../services/customers';
import { customFieldsService } from '../../services/custom-fields';
import { Customer, CustomerInput, CustomerAddress } from '../../types/customer';
import { CustomField } from '../../types';
import { formatCep } from '../../utils/cpfCnpjValidation';
import CustomerBasicInfoSection from '../../components/customers/CustomerBasicInfoSection';
import CustomerContactSection from '../../components/customers/CustomerContactSection';
import CustomerAddressSection from '../../components/customers/CustomerAddressSection';
import CustomerNotesSection from '../../components/customers/CustomerNotesSection';

/**
 * Customer Form Page
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Database-First Architecture
 * - Custom fields integration
 * - Form validation
 * - < 500 lines (refactored into components)
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
                    customer_type: customer.customer_type,
                    email: customer.email,
                    phone: customer.phone,
                    birth_date: customer.birth_date,
                    instagram: customer.instagram,
                    facebook: customer.facebook,
                    address: customer.address,
                    admin_notes: customer.admin_notes,
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

    // Search CEP
    const searchCep = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                updateAddress('street', data.logradouro || '');
                updateAddress('neighborhood', data.bairro || '');
                updateAddress('city', data.localidade || '');
                updateAddress('state', data.uf || '');
                updateAddress('zipCode', formatCep(cleanCep));
                toast.success('CEP encontrado!');
            } else {
                toast.error('CEP não encontrado');
            }
        } catch (err) {
            console.error('Error searching CEP:', err);
            toast.error('Erro ao buscar CEP');
        }
    };

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.name.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }

        if (!formData.cpf_cnpj) {
            toast.error('CPF/CNPJ é obrigatório');
            return;
        }

        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
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
                toast.success('Cliente cadastrado com sucesso!');
            }

            navigate('/admin/customers');
        } catch (err: any) {
            console.error('Error saving customer:', err);

            // Check for duplicate CPF/CNPJ error
            if (err.message && err.message.includes('duplicate key')) {
                toast.error('Este CPF/CNPJ já está cadastrado');
            } else {
                toast.error('Erro ao salvar cliente');
            }
        } finally {
            setSaving(false);
        }
    };

    // Update field
    const updateField = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Update address
    const updateAddress = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            address: {
                ...prev.address,
                [field]: value
            }
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/admin/customers')}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                    </button>
                    <h1 className="text-3xl font-bold text-slate-900">
                        {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
                    </h1>
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

                    {/* Contact */}
                    <CustomerContactSection
                        formData={formData}
                        onFieldUpdate={updateField}
                    />

                    {/* Address */}
                    <CustomerAddressSection
                        address={formData.address || {}}
                        onAddressUpdate={updateAddress}
                        onCepSearch={searchCep}
                    />

                    {/* Admin Notes */}
                    <CustomerNotesSection
                        notes={formData.admin_notes || ''}
                        onNotesUpdate={(notes) => updateField('admin_notes', notes)}
                    />

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
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Salvando...' : 'Salvar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
