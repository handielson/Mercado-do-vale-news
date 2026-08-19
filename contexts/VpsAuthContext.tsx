import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Customer } from '../types/customer';
import type {
    AuthContextType,
    ActivateAccountData,
    CreateAccountData,
    PasswordResetChannel,
    VpsUser,
} from '../types/auth';
import type { TypeUpgradeRequest, RequestedCustomerType } from '../types/typeUpgradeRequest';
import { customerService } from '../services/customers';
import { vpsAuthService } from '../services/vpsAuthService';

const VpsAuthContext = createContext<AuthContextType | undefined>(undefined);

const notify = {
    success: (message: string, options?: Record<string, unknown>) => {
        import('sonner').then(({ toast }) => toast.success(message, options));
    },
    error: (message: string, options?: Record<string, unknown>) => {
        import('sonner').then(({ toast }) => toast.error(message, options));
    },
};

const translateAuthError = (message: string): string => {
    if (!message) return 'Erro desconhecido. Tente novamente.';
    const msg = message.toLowerCase();
    if (msg.includes('senha') || msg.includes('password')) return message;
    if (msg.includes('credenciais') || msg.includes('credentials')) return 'E-mail/CPF ou senha incorretos.';
    if (msg.includes('already') || msg.includes('ja possui')) return 'Este e-mail ou CPF/CNPJ ja possui login.';
    if (msg.includes('network') || msg.includes('failed to fetch')) return 'Falha de conexao. Verifique sua internet e tente novamente.';
    return message;
};

export const VpsAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<VpsUser | null>(null);
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const applySession = (session: { user: VpsUser; customer: Customer } | null) => {
        setUser(session?.user ?? null);
        setCustomer(session?.customer ?? null);
    };

    useEffect(() => {
        let cancelled = false;
        vpsAuthService.getSession()
            .then((session) => {
                if (!cancelled) applySession(session);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const checkCPF = async (cpf: string): Promise<Customer | null> => {
        return customerService.getByCpfCnpj(cpf);
    };

    const signInWithGoogle = async () => {
        const nextPath = typeof sessionStorage === 'undefined'
            ? '/'
            : sessionStorage.getItem('auth_next') || '/';
        vpsAuthService.startGoogleSignIn(nextPath);
    };

    const signInWithFacebook = async () => {
        notify.error('Login com Facebook esta temporariamente indisponivel durante a migracao para VPS.');
        throw new Error('Login com Facebook indisponivel');
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            const session = await vpsAuthService.signInWithEmail(email, password);
            applySession(session);
            notify.success('Login realizado com sucesso!');
        } catch (error: any) {
            notify.error(translateAuthError(error.message));
            throw error;
        }
    };

    const signInWithCpf = async (cpf: string, password: string) => {
        try {
            const session = await vpsAuthService.signInWithCpf(cpf, password);
            applySession(session);
            notify.success('Login realizado com sucesso!');
        } catch (error: any) {
            notify.error(translateAuthError(error.message));
            throw error;
        }
    };

    const activateAccount = async (data: ActivateAccountData) => {
        const existingCustomer = await customerService.getByCpfCnpj(data.cpf_cnpj);
        const session = await vpsAuthService.createAccount({
            name: existingCustomer?.name || data.email?.split('@')[0] || 'Cliente',
            email: data.email,
            password: data.password,
            cpf_cnpj: data.cpf_cnpj,
            phone: data.phone,
            customer_type: (existingCustomer?.customer_type === 'ADMIN' ? 'retail' : existingCustomer?.customer_type) || 'retail',
        });
        applySession(session);
        notify.success('Conta ativada com sucesso!');
    };

    const createAccount = async (data: CreateAccountData) => {
        try {
            const session = await vpsAuthService.createAccount(data);
            applySession(session);
            notify.success('Conta criada com sucesso!');
        } catch (error: any) {
            notify.error(`Erro ao criar conta: ${translateAuthError(error.message)}`);
            throw error;
        }
    };

    const resetPassword = async (identifier: string, channel: PasswordResetChannel = 'email') => {
        await vpsAuthService.requestPasswordReset(identifier, channel);
    };

    const updatePassword = async (newPassword: string, resetToken?: string) => {
        try {
            await vpsAuthService.updatePassword(newPassword, resetToken);
            notify.success('Senha atualizada com sucesso!');
        } catch (error: any) {
            notify.error(translateAuthError(error.message));
            throw error;
        }
    };

    const signOut = async () => {
        vpsAuthService.signOut();
        setUser(null);
        setCustomer(null);
        notify.success('Logout realizado com sucesso!');
    };

    const requestTypeUpgrade = async (requestedType: RequestedCustomerType): Promise<TypeUpgradeRequest> => {
        if (!customer) throw new Error('No customer logged in');
        const { createUpgradeRequest } = await import('../services/typeUpgradeRequests');
        const request = await createUpgradeRequest(customer.id, requestedType);
        notify.success('Solicitacao enviada com sucesso!');
        return request;
    };

    const getUpgradeRequestStatus = async (): Promise<TypeUpgradeRequest | null> => {
        if (!customer) return null;
        const { getCustomerUpgradeRequest } = await import('../services/typeUpgradeRequests');
        return getCustomerUpgradeRequest(customer.id);
    };

    const updateProfile = async (data: Partial<Customer>) => {
        if (!user) throw new Error('No user logged in');
        if (!customer) throw new Error('No customer profile loaded');
        const updated = await vpsAuthService.updateProfile(data);
        setCustomer(updated);
        notify.success('Perfil atualizado com sucesso!');
    };

    const setAdminPreviewType = async (type: 'retail' | 'resale' | 'wholesale') => {
        if (!customer || customer.customer_type !== 'ADMIN') return;
        const updated = { ...customer, admin_preview_type: type };
        setCustomer(updated);
        localStorage.setItem('@mdv_admin_preview', type);
        await customerService.update(customer.id, { admin_preview_type: type } as any);
    };

    return (
        <VpsAuthContext.Provider value={{
            user,
            customer,
            isLoading,
            signInWithGoogle,
            signInWithFacebook,
            signInWithEmail,
            signInWithCpf,
            checkCPF,
            activateAccount,
            createAccount,
            resetPassword,
            updatePassword,
            signOut,
            updateProfile,
            requestTypeUpgrade,
            getUpgradeRequestStatus,
            setAdminPreviewType,
        }}>
            {children}
        </VpsAuthContext.Provider>
    );
};

export const useVpsAuth = () => {
    const context = useContext(VpsAuthContext);
    if (!context) {
        throw new Error('useVpsAuth must be used within VpsAuthProvider');
    }
    return context;
};
