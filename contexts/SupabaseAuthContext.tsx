import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { User } from '@supabase/supabase-js'
import type { Customer } from '../types/customer'
import type {
    AuthContextType,
    ActivateAccountData,
    CreateAccountData
} from '../types/auth'
import { toast } from 'sonner'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const COMPANY_ID = import.meta.env.VITE_COMPANY_ID || 'default-company-id'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                loadCustomerData(session.user.id)
            }
            setIsLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth state changed:', event)
                setUser(session?.user ?? null)

                if (session?.user) {
                    await loadCustomerData(session.user.id)
                } else {
                    setCustomer(null)
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    // Load customer data linked to auth user
    const loadCustomerData = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                console.error('Error loading customer:', error)
                return
            }

            setCustomer(data)
        } catch (error) {
            console.error('Error loading customer:', error)
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
                    customer_type: 'retail',
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

    // Update customer profile
    const updateProfile = async (data: Partial<Customer>) => {
        try {
            if (!customer) throw new Error('No customer logged in')

            const { error } = await supabase
                .from('customers')
                .update(data)
                .eq('id', customer.id)

            if (error) throw error

            // Reload customer data
            if (user) {
                await loadCustomerData(user.id)
            }

            toast.success('Perfil atualizado com sucesso!')
        } catch (error: any) {
            console.error('Update profile error:', error)
            toast.error('Erro ao atualizar perfil')
            throw error
        }
    }

    return (
        <AuthContext.Provider value={{
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
            updateProfile
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
