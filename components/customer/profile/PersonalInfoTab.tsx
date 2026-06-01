import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Calendar,
    Camera,
    CheckCircle2,
    CreditCard,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    MapPin,
    Phone,
    ShieldCheck,
    User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVpsAuth } from '../../../hooks/useVpsAuth';
import { uploadService } from '../../../services/uploadService';

interface AddressData {
    zipCode: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
}

type ProfileSection = 'profile' | 'delivery' | 'security';

const inputBaseClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const inputIconClass = 'w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const disabledInputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-500';

export const PersonalInfoTab: React.FC = () => {
    const { customer, updateProfile, updatePassword } = useVpsAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeSection, setActiveSection] = useState<ProfileSection>('profile');

    const [personalData, setPersonalData] = useState({
        name: customer?.name || '',
        email: customer?.email || '',
        cpf_cnpj: customer?.cpf_cnpj || '',
        phone: customer?.phone || '',
        birth_date: customer?.birth_date || '',
        avatar_url: customer?.avatar_url || '',
    });

    const [addressData, setAddressData] = useState<AddressData>({
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);

    useEffect(() => {
        setPersonalData({
            name: customer?.name || '',
            email: customer?.email || '',
            cpf_cnpj: customer?.cpf_cnpj || '',
            phone: customer?.phone || '',
            birth_date: customer?.birth_date || '',
            avatar_url: customer?.avatar_url || '',
        });

        if (customer?.address) {
            setAddressData({
                zipCode: customer.address.zipCode || '',
                street: customer.address.street || '',
                number: customer.address.number || '',
                complement: customer.address.complement || '',
                neighborhood: customer.address.neighborhood || '',
                city: customer.address.city || '',
                state: customer.address.state || '',
            });
        }
    }, [customer]);

    const profileCompletion = useMemo(() => {
        const checks = [
            { label: 'Nome', done: Boolean(personalData.name) },
            { label: 'Telefone', done: Boolean(personalData.phone) },
            { label: 'CPF/CNPJ', done: Boolean(personalData.cpf_cnpj) },
            { label: 'Nascimento', done: Boolean(personalData.birth_date) },
            { label: 'Endereco', done: Boolean(addressData.zipCode && addressData.street && addressData.number && addressData.city) },
        ];
        const done = checks.filter((item) => item.done).length;
        return {
            done,
            total: checks.length,
            percent: Math.round((done / checks.length) * 100),
            missing: checks.filter((item) => !item.done).map((item) => item.label),
        };
    }, [addressData, personalData]);

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '').slice(0, 11);
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`);
        }
        return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`);
    };

    const formatCPF = (value: string) => {
        const numbers = value.replace(/\D/g, '').slice(0, 14);
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : `${a}.${b}.${c}`);
        }
        return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) => e ? `${a}.${b}.${c}/${d}-${e}` : `${a}.${b}.${c}/${d}`);
    };

    const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            setPersonalData((prev) => ({ ...prev, [name]: formatPhone(value) }));
            return;
        }
        if (name === 'cpf_cnpj') {
            setPersonalData((prev) => ({ ...prev, [name]: formatCPF(value) }));
            return;
        }
        setPersonalData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !customer) return;

        setAvatarLoading(true);
        try {
            const publicUrl = await uploadService.uploadAvatar(file, customer.id);
            setPersonalData((prev) => ({ ...prev, avatar_url: publicUrl }));
            await updateProfile({ avatar_url: publicUrl });
            toast.success('Foto de perfil atualizada com sucesso!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao enviar foto.');
        } finally {
            setAvatarLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const updateAddress = (field: keyof AddressData, value: string) => {
        setAddressData((prev) => ({ ...prev, [field]: value }));
    };

    const searchCep = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        setCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setAddressData((prev) => ({
                    ...prev,
                    street: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    state: data.uf || '',
                }));
                toast.success('CEP encontrado!');
            } else {
                toast.error('CEP nao encontrado');
            }
        } catch (error) {
            console.error('Error fetching CEP:', error);
            toast.error('Erro ao buscar CEP');
        } finally {
            setCepLoading(false);
        }
    };

    const formatCep = (value: string) => {
        const numbers = value.replace(/\D/g, '').slice(0, 8);
        if (numbers.length <= 5) return numbers;
        return numbers.replace(/(\d{5})(\d{1,3})/, '$1-$2');
    };

    const handleCepChange = (value: string) => {
        updateAddress('zipCode', formatCep(value));
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordData((prev) => ({ ...prev, [name]: value }));
    };

    const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
        setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
    };

    const validatePasswordForm = (): boolean => {
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            toast.error('Preencha todos os campos da senha');
            return false;
        }
        if (passwordData.newPassword.length < 6) {
            toast.error('A nova senha deve ter no minimo 6 caracteres');
            return false;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('As senhas nao coincidem');
            return false;
        }
        if (passwordData.currentPassword === passwordData.newPassword) {
            toast.error('A nova senha deve ser diferente da atual');
            return false;
        }
        return true;
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePasswordForm()) return;

        setPasswordLoading(true);
        try {
            await updatePassword(passwordData.newPassword);
            toast.success('Senha alterada com sucesso!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            toast.error(error.message || 'Erro ao alterar senha');
        } finally {
            setPasswordLoading(false);
        }
    };

    const validateForm = (): boolean => {
        if (!personalData.name || !personalData.email) {
            toast.error('Nome e email sao obrigatorios');
            return false;
        }

        if (personalData.phone) {
            const phoneNumbers = personalData.phone.replace(/\D/g, '');
            if (phoneNumbers.length < 10) {
                toast.error('Telefone invalido');
                return false;
            }
        }

        const cepNumbers = addressData.zipCode.replace(/\D/g, '');
        if (cepNumbers || addressData.street || addressData.number) {
            if (cepNumbers.length !== 8) {
                toast.error('CEP invalido');
                return false;
            }
            if (!addressData.street || !addressData.number || !addressData.neighborhood || !addressData.city || !addressData.state) {
                toast.error('Preencha os dados obrigatorios do endereco');
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        try {
            await updateProfile({
                name: personalData.name,
                phone: personalData.phone ? personalData.phone.replace(/\D/g, '') : null,
                birth_date: personalData.birth_date || null,
                avatar_url: personalData.avatar_url,
                address: {
                    zipCode: addressData.zipCode.replace(/\D/g, ''),
                    street: addressData.street,
                    number: addressData.number,
                    complement: addressData.complement,
                    neighborhood: addressData.neighborhood,
                    city: addressData.city,
                    state: addressData.state,
                },
            });
            toast.success('Dados e endereco salvos com sucesso!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao atualizar dados');
        } finally {
            setLoading(false);
        }
    };

    const sectionCards = [
        {
            id: 'profile' as ProfileSection,
            label: 'Perfil e contato',
            detail: personalData.phone ? 'Contato pronto' : 'Telefone pendente',
            icon: User,
        },
        {
            id: 'delivery' as ProfileSection,
            label: 'Entrega principal',
            detail: addressData.zipCode ? `${addressData.city || 'Cidade'} ${addressData.state || ''}`.trim() : 'Endereco pendente',
            icon: MapPin,
        },
        {
            id: 'security' as ProfileSection,
            label: 'Seguranca da conta',
            detail: 'Senha e acesso',
            icon: ShieldCheck,
        },
    ];

    const renderProfilePanel = () => (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                            {personalData.avatar_url ? (
                                <img src={personalData.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                            ) : (
                                <User className="h-9 w-9 text-slate-400" />
                            )}
                            {avatarLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-950">Dados de contato</h3>
                            <p className="mt-1 text-sm text-slate-500">Nome, telefone e foto usados no atendimento e pedidos.</p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                                disabled={avatarLoading}
                            >
                                <Camera className="h-4 w-4" />
                                Alterar foto
                            </button>
                            <input
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleAvatarUpload}
                                disabled={avatarLoading}
                            />
                        </div>
                    </div>

                    <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                        Cadastro completo: {profileCompletion.percent}%
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">Nome completo *</span>
                        <span className="relative block">
                            <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                name="name"
                                value={personalData.name}
                                onChange={handlePersonalChange}
                                placeholder="Seu nome completo"
                                className={inputIconClass}
                                required
                            />
                        </span>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">E-mail</span>
                        <span className="relative block">
                            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input type="email" value={personalData.email} className={disabledInputClass} disabled />
                        </span>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">CPF/CNPJ</span>
                        <span className="relative block">
                            <CreditCard className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input type="text" value={personalData.cpf_cnpj} className={disabledInputClass} disabled />
                        </span>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">Telefone celular</span>
                        <span className="relative block">
                            <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                name="phone"
                                value={personalData.phone}
                                onChange={handlePersonalChange}
                                placeholder="(00) 00000-0000"
                                className={inputIconClass}
                            />
                        </span>
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">Data de nascimento</span>
                        <span className="relative block">
                            <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input
                                type="date"
                                name="birth_date"
                                value={personalData.birth_date}
                                onChange={handlePersonalChange}
                                className={inputIconClass}
                            />
                        </span>
                    </label>
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => setActiveSection('delivery')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                    Ir para entrega
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar alteracoes
                </button>
            </div>
        </form>
    );

    const renderDeliveryPanel = () => (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-950">Endereco principal</h3>
                        <p className="mt-1 text-sm text-slate-500">Usado para calculo de frete e separacao de entrega.</p>
                    </div>
                    {addressData.zipCode ? (
                        <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Endereco salvo
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                            <AlertCircle className="h-4 w-4" />
                            Pendente
                        </span>
                    )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4">
                    <label className="space-y-2 md:col-span-1">
                        <span className="text-sm font-bold text-slate-700">CEP</span>
                        <span className="relative block">
                            <input
                                type="text"
                                value={addressData.zipCode}
                                onChange={(e) => handleCepChange(e.target.value)}
                                onBlur={(e) => searchCep(e.target.value)}
                                placeholder="00000-000"
                                className={`${inputBaseClass} pr-10`}
                                maxLength={9}
                            />
                            {cepLoading && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-blue-600" />}
                        </span>
                    </label>

                    <label className="space-y-2 md:col-span-3">
                        <span className="text-sm font-bold text-slate-700">Rua</span>
                        <input
                            type="text"
                            value={addressData.street}
                            onChange={(e) => updateAddress('street', e.target.value)}
                            placeholder="Nome da rua"
                            className={inputBaseClass}
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">Numero</span>
                        <input
                            type="text"
                            value={addressData.number}
                            onChange={(e) => updateAddress('number', e.target.value)}
                            placeholder="123"
                            className={inputBaseClass}
                        />
                    </label>

                    <label className="space-y-2 md:col-span-3">
                        <span className="text-sm font-bold text-slate-700">Complemento</span>
                        <input
                            type="text"
                            value={addressData.complement}
                            onChange={(e) => updateAddress('complement', e.target.value)}
                            placeholder="Apto, bloco, referencia"
                            className={inputBaseClass}
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-bold text-slate-700">Bairro</span>
                        <input
                            type="text"
                            value={addressData.neighborhood}
                            onChange={(e) => updateAddress('neighborhood', e.target.value)}
                            placeholder="Nome do bairro"
                            className={inputBaseClass}
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">Cidade</span>
                        <input
                            type="text"
                            value={addressData.city}
                            onChange={(e) => updateAddress('city', e.target.value)}
                            placeholder="Cidade"
                            className={inputBaseClass}
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-sm font-bold text-slate-700">Estado</span>
                        <select
                            value={addressData.state}
                            onChange={(e) => updateAddress('state', e.target.value)}
                            className={inputBaseClass}
                        >
                            <option value="">UF</option>
                            {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map((uf) => (
                                <option key={uf} value={uf}>{uf}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={() => setActiveSection('security')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                    Ir para seguranca
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar alteracoes
                </button>
            </div>
        </form>
    );

    const renderSecurityPanel = () => (
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                    <h3 className="text-lg font-black text-slate-950">Seguranca da conta</h3>
                    <p className="mt-1 text-sm text-slate-500">Atualize sua senha de acesso quando precisar.</p>
                </div>

                <div className="mt-6 max-w-2xl space-y-5">
                    <PasswordField
                        label="Senha atual *"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        visible={showPasswords.current}
                        onChange={handlePasswordChange}
                        onToggle={() => togglePasswordVisibility('current')}
                        placeholder="Digite sua senha atual"
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <PasswordField
                            label="Nova senha *"
                            name="newPassword"
                            value={passwordData.newPassword}
                            visible={showPasswords.new}
                            onChange={handlePasswordChange}
                            onToggle={() => togglePasswordVisibility('new')}
                            placeholder="Minimo 6 caracteres"
                        />
                        <PasswordField
                            label="Confirmar nova senha *"
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            visible={showPasswords.confirm}
                            onChange={handlePasswordChange}
                            onToggle={() => togglePasswordVisibility('confirm')}
                            placeholder="Digite novamente"
                        />
                    </div>

                    {(passwordData.newPassword || passwordData.confirmPassword) && (
                        <div className="rounded-xl bg-slate-50 p-4 text-xs font-medium">
                            <p className={passwordData.newPassword.length >= 6 ? 'text-emerald-700' : 'text-slate-500'}>
                                {passwordData.newPassword.length >= 6 ? 'OK' : '-'} Minimo de 6 caracteres
                            </p>
                            {passwordData.confirmPassword && (
                                <p className={passwordData.newPassword === passwordData.confirmPassword ? 'mt-1 text-emerald-700' : 'mt-1 text-red-600'}>
                                    {passwordData.newPassword === passwordData.confirmPassword ? 'OK' : 'Ajustar'} Senhas coincidem
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Alterar senha
                </button>
            </div>
        </form>
    );

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-bold text-blue-700">Resumo dos dados</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">Meus Dados</h2>
                        <p className="mt-1 text-sm text-slate-500">Cadastro, entrega e acesso em uma area unica.</p>
                    </div>

                    <div className="min-w-[220px]">
                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>Cadastro completo</span>
                            <span className="text-blue-700">{profileCompletion.percent}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${profileCompletion.percent}%` }} />
                        </div>
                    </div>
                </div>

                {profileCompletion.missing.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                        Pendencias: {profileCompletion.missing.join(', ')}.
                    </div>
                )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {sectionCards.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                        <button
                            key={section.id}
                            type="button"
                            aria-current={activeSection === section.id ? 'page' : undefined}
                            onClick={() => setActiveSection(section.id)}
                            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${isActive
                                ? 'border-blue-200 bg-blue-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                                }`}
                        >
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-black text-slate-950">{section.label}</span>
                                <span className="block truncate text-xs font-medium text-slate-500">{section.detail}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeSection === 'profile' && renderProfilePanel()}
            {activeSection === 'delivery' && renderDeliveryPanel()}
            {activeSection === 'security' && renderSecurityPanel()}
        </div>
    );
};

interface PasswordFieldProps {
    label: string;
    name: string;
    value: string;
    visible: boolean;
    placeholder: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onToggle: () => void;
}

function PasswordField({ label, name, value, visible, placeholder, onChange, onToggle }: PasswordFieldProps) {
    return (
        <label className="space-y-2">
            <span className="text-sm font-bold text-slate-700">{label}</span>
            <span className="relative block">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                    type={visible ? 'text' : 'password'}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    required
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3 top-3.5 text-slate-400 transition hover:text-slate-700"
                    aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </span>
        </label>
    );
}
