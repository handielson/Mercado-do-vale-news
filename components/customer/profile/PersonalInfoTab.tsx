import React, { useState, useEffect, useRef } from 'react';
import { Loader2, User, Mail, CreditCard, Phone, Calendar, MapPin, Lock, Eye, EyeOff, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabaseAuth } from '../../../hooks/useSupabaseAuth';
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

/**
 * Personal Info & Address Tab Component
 * 
 * Allows customer to edit personal information and address
 */
export const PersonalInfoTab: React.FC = () => {
    const { customer, updateProfile } = useSupabaseAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Personal Data
    const [personalData, setPersonalData] = useState({
        name: customer?.name || '',
        email: customer?.email || '',
        cpf_cnpj: customer?.cpf_cnpj || '',
        phone: customer?.phone || '',
        birth_date: customer?.birth_date || '',
        avatar_url: customer?.avatar_url || ''
    });

    // Address Data
    const [addressData, setAddressData] = useState<AddressData>({
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: ''
    });

    // Password Data
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [cepLoading, setCepLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);

    // Auth methods for password
    const { updatePassword } = useSupabaseAuth();

    useEffect(() => {
        if (customer?.address) {
            setAddressData({
                zipCode: customer.address.zipCode || '',
                street: customer.address.street || '',
                number: customer.address.number || '',
                complement: customer.address.complement || '',
                neighborhood: customer.address.neighborhood || '',
                city: customer.address.city || '',
                state: customer.address.state || ''
            });
        }
    }, [customer]);

    // ---- Personal Methods ----
    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    const formatCPF = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    const handlePersonalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            setPersonalData(prev => ({ ...prev, [name]: formatPhone(value) }));
        } else if (name === 'cpf_cnpj') {
            setPersonalData(prev => ({ ...prev, [name]: formatCPF(value) }));
        } else {
            setPersonalData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !customer) return;

        setAvatarLoading(true);
        try {
            const publicUrl = await uploadService.uploadAvatar(file, customer.id);
            setPersonalData(prev => ({ ...prev, avatar_url: publicUrl }));
            
            // Auto save para a experiência ficar mais fluida
            await updateProfile({ avatar_url: publicUrl });
            toast.success('Foto de perfil atualizada com sucesso!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao enviar foto.');
        } finally {
            setAvatarLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Limpa input
            }
        }
    };

    // ---- Address Methods ----
    const updateAddress = (field: keyof AddressData, value: string) => {
        setAddressData(prev => ({ ...prev, [field]: value }));
    };

    const searchCep = async (cep: string) => {
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) return;

        setCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setAddressData(prev => ({
                    ...prev,
                    street: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    state: data.uf || ''
                }));
                toast.success('CEP encontrado!');
            } else {
                toast.error('CEP não encontrado');
            }
        } catch (error) {
            console.error('Error fetching CEP:', error);
            toast.error('Erro ao buscar CEP');
        } finally {
            setCepLoading(false);
        }
    };

    const formatCep = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 5) return numbers;
        return numbers.replace(/(\d{5})(\d{1,3})/, '$1-$2');
    };

    const handleCepChange = (value: string) => {
        const formatted = formatCep(value);
        updateAddress('zipCode', formatted);
    };

    // ---- Password Methods ----
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };

    const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const validatePasswordForm = (): boolean => {
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            toast.error('Preencha todos os campos da senha');
            return false;
        }
        if (passwordData.newPassword.length < 6) {
            toast.error('A nova senha deve ter no mínimo 6 caracteres');
            return false;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('As senhas não coincidem');
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

    // ---- Submit ----
    const validateForm = (): boolean => {
        if (!personalData.name || !personalData.email) {
            toast.error('Nome e email são obrigatórios');
            return false;
        }

        if (personalData.phone) {
            const phoneNumbers = personalData.phone.replace(/\D/g, '');
            if (phoneNumbers.length < 10) {
                toast.error('Telefone inválido');
                return false;
            }
        }

        const cepNumbers = addressData.zipCode.replace(/\D/g, '');
        // If they started filling address, enforce rules
        if (cepNumbers || addressData.street || addressData.number) {
            if (cepNumbers.length !== 8) {
                toast.error('CEP inválido');
                return false;
            }
            if (!addressData.street || !addressData.number || !addressData.neighborhood || !addressData.city || !addressData.state) {
                toast.error('Preencha os dados obrigatórios do endereço');
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
                    state: addressData.state
                }
            });
            toast.success('Dados e endereço salvos com sucesso!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao atualizar dados');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Meus Dados</h2>
            <p className="text-slate-600 mb-8">
                Mantenha suas informações e endereço de entrega sempre atualizados.
            </p>

            <form onSubmit={handleSubmit} className="space-y-10">
                {/* 1. DADOS PESSOAIS */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4 border-b pb-2">
                        <User size={20} className="text-blue-600" />
                        Informações Pessoais
                    </h3>

                    {/* Foto de Perfil */}
                    <div className="mb-8 flex flex-col items-start gap-3">
                        <label className="text-sm font-semibold text-slate-700">Foto de Perfil (Avatar)</label>
                        <div className="flex items-center gap-4">
                            <div className="relative group w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 bg-slate-100 flex items-center justify-center shrink-0">
                                {personalData.avatar_url ? (
                                    <img
                                        src={personalData.avatar_url}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <User size={40} className="text-slate-400" />
                                )}

                                {avatarLoading ? (
                                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                    >
                                        <Camera className="text-white" size={24} />
                                    </button>
                                )}
                            </div>
                            <div className="text-sm text-slate-500 max-w-[200px]">
                                <p>Sua foto será exibida em suas <strong>avaliações</strong> e atividades no site.</p>
                                <button 
                                    type="button" 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-blue-600 mt-1 font-medium hover:underline"
                                >
                                    Alterar foto
                                </button>
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/webp"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleAvatarUpload}
                            disabled={avatarLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Nome Completo *</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    name="name"
                                    value={personalData.name}
                                    onChange={handlePersonalChange}
                                    placeholder="Seu nome completo"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    value={personalData.email}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
                                    disabled
                                />
                            </div>
                        </div>

                        {/* CPF */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">CPF/CNPJ</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={personalData.cpf_cnpj}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed"
                                    disabled
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Telefone celular</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    name="phone"
                                    value={personalData.phone}
                                    onChange={handlePersonalChange}
                                    placeholder="(00) 00000-0000"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Birth */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Data de Nascimento</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                <input
                                    type="date"
                                    name="birth_date"
                                    value={personalData.birth_date}
                                    onChange={handlePersonalChange}
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. ENDEREÇO */}
                <section>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4 border-b pb-2">
                        <MapPin size={20} className="text-blue-600" />
                        Endereço de Entrega
                    </h3>

                    <div className="space-y-6">
                        {/* CEP */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">CEP</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={addressData.zipCode}
                                        onChange={(e) => handleCepChange(e.target.value)}
                                        onBlur={(e) => searchCep(e.target.value)}
                                        placeholder="00000-000"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        maxLength={9}
                                    />
                                    {cepLoading && (
                                        <Loader2 className="absolute right-3 top-3 animate-spin text-blue-600" size={20} />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Street & Number */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-3 space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Rua</label>
                                <input
                                    type="text"
                                    value={addressData.street}
                                    onChange={(e) => updateAddress('street', e.target.value)}
                                    placeholder="Nome da rua"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Número</label>
                                <input
                                    type="text"
                                    value={addressData.number}
                                    onChange={(e) => updateAddress('number', e.target.value)}
                                    placeholder="123"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Complement */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Complemento</label>
                            <input
                                type="text"
                                value={addressData.complement}
                                onChange={(e) => updateAddress('complement', e.target.value)}
                                placeholder="Apto, Bloco, etc (opcional)"
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        {/* Neighborhood & City */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Bairro</label>
                                <input
                                    type="text"
                                    value={addressData.neighborhood}
                                    onChange={(e) => updateAddress('neighborhood', e.target.value)}
                                    placeholder="Nome do bairro"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Cidade</label>
                                <input
                                    type="text"
                                    value={addressData.city}
                                    onChange={(e) => updateAddress('city', e.target.value)}
                                    placeholder="Nome da cidade"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* State */}
                        <div className="space-y-2 md:w-1/3">
                            <label className="text-sm font-semibold text-slate-700">Estado</label>
                            <select
                                value={addressData.state}
                                onChange={(e) => updateAddress('state', e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
                </section>

                {/* Submit Button */}
                <div className="pt-4 border-t border-slate-200">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full md:w-auto px-8 bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            'Salvar Dados e Endereço'
                        )}
                    </button>
                </div>
            </form>

            {/* 3. SENHA */}
            <form onSubmit={handlePasswordSubmit} className="space-y-6 mt-16 pt-8 border-t border-slate-200">
                <section>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
                        <Lock size={20} className="text-blue-600" />
                        Segurança e Senha
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">Mantenha sua conta segura alterando sua senha regularmente.</p>

                    <div className="space-y-6 max-w-xl">
                        {/* Current Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Senha Atual *</label>
                            <div className="relative">
                                <input
                                    type={showPasswords.current ? 'text' : 'password'}
                                    name="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={handlePasswordChange}
                                    placeholder="Digite sua senha atual"
                                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('current')}
                                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                                >
                                    {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* New and Confirm Password Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* New Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Nova Senha *</label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Mínimo 6 dígitos"
                                        className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility('new')}
                                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Confirmar Nova Senha *</label>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Digite novamente"
                                        className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility('confirm')}
                                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Password Feedbacks */}
                        {(passwordData.newPassword || passwordData.confirmPassword) && (
                            <div className="text-xs space-y-1">
                                <p className={`${passwordData.newPassword.length >= 6 ? 'text-green-600' : 'text-slate-500'}`}>
                                    {passwordData.newPassword.length >= 6 ? '✓' : '•'} Mínimo de 6 caracteres
                                </p>
                                {passwordData.confirmPassword && (
                                    <p className={`${passwordData.newPassword === passwordData.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                                        {passwordData.newPassword === passwordData.confirmPassword ? '✓' : '✗'} As senhas coincidem
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={passwordLoading}
                                className="w-full md:w-auto px-8 bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {passwordLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        <span>Alterando...</span>
                                    </>
                                ) : (
                                    'Alterar Senha'
                                )}
                            </button>
                        </div>
                    </div>
                </section>
            </form>
        </div>
    );
};
