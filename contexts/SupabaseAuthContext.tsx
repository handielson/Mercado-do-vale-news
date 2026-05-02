import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Customer } from '../types/customer'
import type {
    AuthContextType,
    ActivateAccountData,
    CreateAccountData
} from '../types/auth'
import type { TypeUpgradeRequest, RequestedCustomerType } from '../types/typeUpgradeRequest'
import { getSupabaseClient } from '../services/lazySupabase'

const SupabaseAuthContext = createContext<AuthContextType | undefined>(undefined)

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID || 'default-company-id'
const AUTH_CALLBACK_PATH = '/auth/callback'
const PRODUCTION_ORIGIN = 'https://www.mercadodovale.com.br'

const getAuthCallbackUrl = () => {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    const origin = isLocalhost ? PRODUCTION_ORIGIN : window.location.origin
    return new URL(AUTH_CALLBACK_PATH, origin).toString()
}

const notify = {
    success: (message: string, options?: Record<string, unknown>) => {
        import('sonner').then(({ toast }) => toast.success(message, options))
    },
    error: (message: string, options?: Record<string, unknown>) => {
        import('sonner').then(({ toast }) => toast.error(message, options))
    },
    info: (message: string, options?: Record<string, unknown>) => {
        import('sonner').then(({ toast }) => toast.info(message, options))
    },
}

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        console.log('[DEBUG] SupabaseAuthContext MOUNTED');
        let isMounted = true;

        // Timeout de segurança: se o Supabase não responder em 5s (ex: CORS bloqueando),
        // desbloquear a aplicação para que usuários anônimos possam navegar normalmente.
        const authTimeout = setTimeout(() => {
            if (isMounted) {
                console.warn('[SupabaseAuth] Auth timeout – forcing isLoading=false to unblock app.');
                setIsLoading(false);
            }
        }, 5000);

        let subscription: { unsubscribe: () => void } | null = null;

        getSupabaseClient()
            .then((supabase) => {
                if (!isMounted) return;

                const { data } = supabase.auth.onAuthStateChange(
                    (event, session) => { // NOT async - synchronous to prevent concurrent callbacks
                        if (!isMounted) return;
                        console.log('Auth state changed:', event);

                        // Limpar timeout pois o Supabase respondeu
                        clearTimeout(authTimeout);

                        setUser(session?.user ?? null);

                        if (!session?.user) {
                            // User signed out - clear customer and stop loading
                            setCustomer(null);
                            setIsLoading(false);
                        }
                        // Note: when user is authenticated, loading is managed by the
                        // customer fetch useEffect below (depends on user?.id).
                        // We must NOT call setIsLoading(true) here because token refreshes
                        // also fire SIGNED_IN with the same user, causing unnecessary
                        // unmount/remount of protected pages (e.g. PDV).
                    }
                );

                subscription = data.subscription;
            })
            .catch((error) => {
                console.error('[SupabaseAuth] Failed to initialize auth listener:', error);
                if (!isMounted) return;
                clearTimeout(authTimeout);
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
            clearTimeout(authTimeout);
            subscription?.unsubscribe();
        };
    }, [])

    // Separate effect to load customer data only when the user ID actually changes.
    // This is the key fix: even if INITIAL_SESSION + SIGNED_IN both fire for the same user,
    // this effect runs only ONCE since user?.id doesn't change between the two events.
    useEffect(() => {
        if (!user) return;

        let cancelled = false;
        setIsLoading(true);

        loadCustomerData(user.id)
            .catch(err => {
                if (cancelled) return;
                console.error('[SupabaseAuth] Failed to load customer:', err);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]) // Only re-run when the user ID changes, not on every render


    // Load customer data linked to auth user
    const loadCustomerData = async (userId: string) => {
        try {
            const supabase = await getSupabaseClient()
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle() // Use maybeSingle instead of single to avoid error when no record exists

            if (error) {
                console.error('[SupabaseAuth] Error loading customer:', error)
                return
            }

            // If customer exists, set it
            if (data) {
                console.log('[SupabaseAuth] Customer loaded:', data.name)
                
                // Inject local preview preference if admin
                if (data.customer_type === 'ADMIN') {
                    const localPreview = localStorage.getItem('@mdv_admin_preview');
                    if (localPreview && ['retail', 'resale', 'wholesale'].includes(localPreview)) {
                        data.admin_preview_type = localPreview as any;
                    }
                }
                
                setCustomer(data)
                return
            }

            // Customer doesn't exist - create it automatically with Google profile data
            console.log('[SupabaseAuth] No customer found, creating from auth user...')

            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                console.error('[SupabaseAuth] No auth user found')
                return
            }

            const newCustomer = {
                user_id: userId,
                company_id: COMPANY_ID,
                name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
                email: authUser.email || '',
                account_status: 'pending' as const, // Pending until they complete CPF/phone
                customer_type: 'retail' as const,
                is_active: true
            }

            console.log('[SupabaseAuth] Creating customer:', newCustomer)

            const { data: createdCustomer, error: createError } = await supabase
                .from('customers')
                .insert(newCustomer)
                .select()
                .single()

            if (createError) {
                console.error('[SupabaseAuth] Error creating customer:', createError)
                notify.info('Quase lá! Complete seu cadastro para continuar.', {
                    description: 'Informe CPF/CNPJ e telefone para finalizar compras e pagamentos.'
                })
                return
            }

            console.log('[SupabaseAuth] Customer created successfully')
            setCustomer(createdCustomer)
        } catch (error) {
            console.error('[SupabaseAuth] Error in loadCustomerData:', error)
        }
    }

    // Check if CPF already exists
    const checkCPF = async (cpf: string): Promise<Customer | null> => {
        try {
            const supabase = await getSupabaseClient()
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('cpf_cnpj', cpf)
                .maybeSingle()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error checking CPF:', error)
            throw error
        }
    }

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: getAuthCallbackUrl()
                }
            })
            if (error) throw error
        } catch (error: any) {
            console.error('Google sign in error:', error)
            notify.error('Erro ao fazer login com Google')
            throw error
        }
    }

    // Sign in with Facebook
    const signInWithFacebook = async () => {
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: {
                    redirectTo: getAuthCallbackUrl()
                }
            })
            if (error) throw error
        } catch (error: any) {
            console.error('Facebook sign in error:', error)
            notify.error('Erro ao fazer login com Facebook')
            throw error
        }
    }

    // Sign in with email/password
    const signInWithEmail = async (email: string, password: string) => {
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })
            if (error) throw error
            notify.success('Login realizado com sucesso!')
        } catch (error: any) {
            console.error('Email sign in error:', error)
            notify.error('Email ou senha incorretos')
            throw error
        }
    }

    // Sign in with CPF + password (uses placeholder email internally)
    const signInWithCpf = async (cpf: string, password: string) => {
        const digits = cpf.replace(/\D/g, '')
        if (!digits) throw new Error('CPF inválido')
        const email = `${digits}@cliente.mercadodovale.com.br`
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw new Error('CPF ou senha incorretos')
            notify.success('Login realizado com sucesso!')
        } catch (error: any) {
            notify.error(error.message || 'CPF ou senha incorretos')
            throw error
        }
    }


    // Activate existing customer account
    const activateAccount = async (data: ActivateAccountData) => {
        try {
            const supabase = await getSupabaseClient()
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        name: data.cpf_cnpj, // Will be updated from customer
                        cpf_cnpj: data.cpf_cnpj
                    },
                    emailRedirectTo: getAuthCallbackUrl()
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Failed to create user')

            // 2. Update customer record with user_id
            const { error: updateError } = await supabase
                .from('customers')
                .update({
                    user_id: authData.user.id,
                    email: data.email,
                    phone: data.phone || null,
                    account_status: 'active'
                })
                .eq('cpf_cnpj', data.cpf_cnpj)

            if (updateError) throw updateError

            // 3. Load customer data
            await loadCustomerData(authData.user.id)

            notify.success('Conta ativada com sucesso!')
        } catch (error: any) {
            console.error('Activate account error:', error)
            notify.error(`Erro ao ativar conta: ${error.message}`)
            throw error
        }
    }

    // Create new customer account
    const createAccount = async (data: CreateAccountData) => {
        try {
            const supabase = await getSupabaseClient()
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        name: data.name,
                        cpf_cnpj: data.cpf_cnpj
                    },
                    emailRedirectTo: getAuthCallbackUrl()
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Failed to create user')

            // 2. Create customer record
            const { error: customerError } = await supabase
                .from('customers')
                .insert({
                    user_id: authData.user.id,
                    company_id: COMPANY_ID,
                    name: data.name,
                    cpf_cnpj: data.cpf_cnpj,
                    email: data.email,
                    phone: data.phone || null,
                    birth_date: data.birth_date || null,
                    customer_type: data.customer_type || 'retail',
                    is_active: true,
                    account_status: 'active',
                    address: data.address || null
                })

            if (customerError) throw customerError

            // 3. Load customer data
            await loadCustomerData(authData.user.id)

            notify.success('Conta criada com sucesso!')
        } catch (error: any) {
            console.error('Create account error:', error)
            notify.error(`Erro ao criar conta: ${error.message}`)
            throw error
        }
    }

    // Request password reset
    const resetPassword = async (email: string) => {
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/redefinir-senha`
            })
            if (error) throw error
            notify.success('Email de recuperação enviado!')
        } catch (error: any) {
            console.error('Reset password error:', error)
            notify.error('Erro ao enviar email de recuperação')
            throw error
        }
    }

    // Update password
    const updatePassword = async (newPassword: string) => {
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })
            if (error) throw error
            notify.success('Senha atualizada com sucesso!')
        } catch (error: any) {
            console.error('Update password error:', error)
            notify.error('Erro ao atualizar senha')
            throw error
        }
    }

    // Sign out
    const signOut = async () => {
        try {
            const supabase = await getSupabaseClient()
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            setUser(null)
            setCustomer(null)
            notify.success('Logout realizado com sucesso!')
        } catch (error: any) {
            console.error('Sign out error:', error)
            notify.error('Erro ao fazer logout')
            throw error
        }
    }

    // Request type upgrade
    const requestTypeUpgrade = async (requestedType: RequestedCustomerType): Promise<TypeUpgradeRequest> => {
        if (!customer) throw new Error('No customer logged in')

        try {
            const { createUpgradeRequest } = await import('../services/typeUpgradeRequests')
            const request = await createUpgradeRequest(customer.id, requestedType)
            notify.success('Solicitação enviada com sucesso!')
            return request
        } catch (error: any) {
            notify.error(error.message || 'Erro ao enviar solicitação')
            throw error
        }
    }

    // Get upgrade request status
    const getUpgradeRequestStatus = async (): Promise<TypeUpgradeRequest | null> => {
        if (!customer) return null

        try {
            const { getCustomerUpgradeRequest } = await import('../services/typeUpgradeRequests')
            return await getCustomerUpgradeRequest(customer.id)
        } catch (error) {
            console.error('Error getting upgrade request:', error)
            return null
        }
    }

    // Update customer profile
    const updateProfile = async (data: Partial<Customer>) => {
        try {
            if (!user) throw new Error('No user logged in')
            const supabase = await getSupabaseClient()

            // If customer doesn't exist, create it (for OAuth users)
            if (!customer) {
                console.log('[SupabaseAuth] Creating new customer for OAuth user')

                const { error: createError } = await supabase
                    .from('customers')
                    .insert({
                        user_id: user.id,
                        company_id: COMPANY_ID,
                        name: data.name || user.user_metadata?.full_name || user.email || 'Usuário',
                        email: data.email || user.email || '',
                        cpf_cnpj: data.cpf_cnpj || '',
                        phone: data.phone || '',
                        customer_type: 'retail',
                        is_active: true,
                        account_status: 'active'
                    })

                if (createError) throw createError

                // Reload customer data
                await loadCustomerData(user.id)

                notify.success('Perfil criado com sucesso!')
                return
            }

            // Update existing customer
            const { error } = await supabase
                .from('customers')
                .update(data)
                .eq('id', customer.id)

            if (error) throw error

            // Reload customer data
            await loadCustomerData(user.id)

            notify.success('Perfil atualizado com sucesso!')
        } catch (error: any) {
            console.error('Update profile error:', error)
            notify.error('Erro ao atualizar perfil')
            throw error
        }
    }

    // Set admin preview type
    const setAdminPreviewType = async (type: 'retail' | 'resale' | 'wholesale') => {
        if (!customer || customer.customer_type !== 'ADMIN') return;

        // Optimistic UI update + persistent local storage (bypasses RLS issues on customers table)
        setCustomer({ ...customer, admin_preview_type: type });
        localStorage.setItem('@mdv_admin_preview', type);

        try {
            const supabase = await getSupabaseClient()
            // Attempt to sync to DB (might fail silently due to RLS, but that's fine since local state works)
            await supabase
                .from('customers')
                .update({ admin_preview_type: type })
                .eq('id', customer.id);
        } catch (err) {
            console.error('[SupabaseAuth] Error syncing admin_preview_type:', err);
        }
    }

    return (
        <SupabaseAuthContext.Provider value={{
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
            setAdminPreviewType
        }}>
            {children}
        </SupabaseAuthContext.Provider>
    )
}

export const useSupabaseAuth = () => {
    const context = useContext(SupabaseAuthContext)
    if (!context) {
        throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
    }
    return context
}
