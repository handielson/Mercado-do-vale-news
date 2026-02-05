import type { User } from '@supabase/supabase-js'
import type { Customer } from './customer'

// Account status types
export type AccountStatus = 'pending' | 'active'

// OAuth providers supported
export type AuthProvider = 'email' | 'google' | 'facebook'

// Auth context type
export interface AuthContextType {
    user: User | null
    customer: Customer | null
    isLoading: boolean

    // Authentication methods
    signInWithGoogle: () => Promise<void>
    signInWithFacebook: () => Promise<void>
    signInWithEmail: (email: string, password: string) => Promise<void>

    // Account creation/activation
    checkCPF: (cpf: string) => Promise<Customer | null>
    activateAccount: (data: ActivateAccountData) => Promise<void>
    createAccount: (data: CreateAccountData) => Promise<void>

    // Password recovery
    resetPassword: (email: string) => Promise<void>
    updatePassword: (newPassword: string) => Promise<void>

    // Other
    signOut: () => Promise<void>
    updateProfile: (data: Partial<Customer>) => Promise<void>
}

// Data for activating existing customer account
export interface ActivateAccountData {
    cpf_cnpj: string
    email: string
    phone?: string
    password: string
}

// Data for creating new customer account
export interface CreateAccountData {
    name: string
    cpf_cnpj: string
    email: string
    phone?: string
    password: string
    address?: {
        street?: string
        number?: string
        complement?: string
        neighborhood?: string
        city?: string
        state?: string
        zipCode?: string
    }
}

// Recovery code (for WhatsApp recovery)
export interface RecoveryCode {
    id: string
    cpf_cnpj: string
    code: string
    expires_at: string
    used: boolean
    created_at: string
}
