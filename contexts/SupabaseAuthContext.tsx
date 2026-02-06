import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { User } from '@supabase/supabase-js'
import type { Customer } from '../types/customer'
import type {
    AuthContextType,
    ActivateAccountData,
    CreateAccountData
} from '../types/auth'
import type { TypeUpgradeRequest, RequestedCustomerType } from '../types/typeUpgradeRequest'
import { createUpgradeRequest, getCustomerUpgradeRequest } from '../services/typeUpgradeRequests'
import { toast } from 'sonner'

const SupabaseAuthContext = createContext<AuthContextType | undefined>(undefined)

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID || 'default-company-id'

export const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        console.log('[DEBUG] SupabaseAuthContext MOUNTED');
        let isMounted = true;

        // Check current session
        console.log('[DEBUG] Starting getSession...');
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                console.log('[DEBUG] getSession resolved, isMounted:', isMounted);
                if (!isMounted) {
                    console.warn('[DEBUG] Component unmounted before getSession resolved!');
                    return;
                }

                setUser(session?.user ?? null)
                if (session?.user) {
                    console.log('[DEBUG] Loading customer data for user:', session.user.id);
                    loadCustomerData(session.user.id).catch(err => {
                        if (!isMounted) return;
                        console.error('[SupabaseAuth] Failed to load customer data:', err)
                        // Don't block - user can still use the app
                    })
                } else {
                    console.log('[DEBUG] No session found');
                }
                setIsLoading(false)
            })
            .catch(err => {
                console.error('[DEBUG] getSession error, isMounted:', isMounted);
                if (!isMounted) return;
                console.error('[SupabaseAuth] Session error:', err)
                setIsLoading(false) // Critical: always set loading to false
            })

        // Listen for auth changes
        console.log('[DEBUG] Setting up auth state listener...');
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[DEBUG] Auth state changed:', event, 'isMounted:', isMounted);
                if (!isMounted) {
                    console.warn('[DEBUG] Component unmounted before auth state change!');
                    return;
                }

                console.log('Auth state changed:', event)
                setUser(session?.user ?? null)

                if (session?.user) {
                    await loadCustomerData(session.user.id).catch(err => {
                        if (!isMounted) return;
                        console.error('[SupabaseAuth] Failed to load customer on auth change:', err)
                    })
                } else {
                    setCustomer(null)
                }
            }
        )

        return () => {
            console.log('[DEBUG] SupabaseAuthContext UNMOUNTING');
            isMounted = false;
            subscription.unsubscribe();
        }
    }, [])

    // Load customer data linked to auth user
    const loadCustomerData = async (userId: string) => {
        try {
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
                toast.error('Erro ao criar registro de cliente')
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
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            })
            if (error) throw error
        } catch (error: any) {
            console.error('Google sign in error:', error)
            toast.error('Erro ao fazer login com Google')
            throw error
        }
    }

    // Sign in with Facebook
    const signInWithFacebook = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`
                }
            })
            if (error) throw error
        } catch (error: any) {
            console.error('Facebook sign in error:', error)
            toast.error('Erro ao fazer login com Facebook')
            throw error
        }
    }

    // Sign in with email/password
    const signInWithEmail = async (email: string, password: string) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })
            if (error) throw error
            toast.success('Login realizado com sucesso!')
        } catch (error: any) {
            console.error('Email sign in error:', error)
            toast.error('Email ou senha incorretos')
            throw error
        }
    }

    // Activate existing customer account
    const activateAccount = async (data: ActivateAccountData) => {
        try {
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        name: data.cpf_cnpj, // Will be updated from customer
                        cpf_cnpj: data.cpf_cnpj
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`
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

            toast.success('Conta ativada com sucesso!')
        } catch (error: any) {
            console.error('Activate account error:', error)
            toast.error(`Erro ao ativar conta: ${error.message}`)
            throw error
        }
    }

    // Create new customer account
    const createAccount = async (data: CreateAccountData) => {
        try {
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        name: data.name,
                        cpf_cnpj: data.cpf_cnpj
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`
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

            toast.success('Conta criada com sucesso!')
        } catch (error: any) {
            console.error('Create account error:', error)
            toast.error(`Erro ao criar conta: ${error.message}`)
            throw error
        }
    }

    // Request password reset
    const resetPassword = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/redefinir-senha`
            })
            if (error) throw error
            toast.success('Email de recuperação enviado!')
        } catch (error: any) {
            console.error('Reset password error:', error)
            toast.error('Erro ao enviar email de recuperação')
            throw error
        }
    }

    // Update password
    const updatePassword = async (newPassword: string) => {
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            })
            if (error) throw error
            toast.success('Senha atualizada com sucesso!')
        } catch (error: any) {
            console.error('Update password error:', error)
            toast.error('Erro ao atualizar senha')
            throw error
        }
    }

    // Sign out
    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            setUser(null)
            setCustomer(null)
            toast.success('Logout realizado com sucesso!')
        } catch (error: any) {
            console.error('Sign out error:', error)
            toast.error('Erro ao fazer logout')
            throw error
        }
    }

    // Request type upgrade
    const requestTypeUpgrade = async (requestedType: RequestedCustomerType): Promise<TypeUpgradeRequest> => {
        if (!customer) throw new Error('No customer logged in')

        try {
            const request = await createUpgradeRequest(customer.id, requestedType)
            toast.success('Solicitação enviada com sucesso!')
            return request
        } catch (error: any) {
            toast.error(error.message || 'Erro ao enviar solicitação')
            throw error
        }
    }

    // Get upgrade request status
    const getUpgradeRequestStatus = async (): Promise<TypeUpgradeRequest | null> => {
        if (!customer) return null

        try {
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

                toast.success('Perfil criado com sucesso!')
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

            toast.success('Perfil atualizado com sucesso!')
        } catch (error: any) {
            console.error('Update profile error:', error)
            toast.error('Erro ao atualizar perfil')
            throw error
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
            checkCPF,
            activateAccount,
            createAccount,
            resetPassword,
            updatePassword,
            signOut,
            updateProfile,
            requestTypeUpgrade,
            getUpgradeRequestStatus
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
