/**
 * config/migration.ts
 * Feature flags para controlar a migração gradual do Supabase para VPS MySQL.
 *
 * COMO USAR:
 *   import { USE_VPS } from '@/config/migration';
 *   if (USE_VPS.banners) { ... } else { ... }
 *
 * ATIVAR UMA FLAG:
 *   Mude o valor de false → true e faça deploy.
 *   Teste no ambiente de produção antes de desligar o Supabase.
 *
 * ORDEM RECOMENDADA DE ATIVAÇÃO:
 *   Semana 1: banners, shipping, coupons, paymentFees, company
 *   Semana 2: customers (leitura), orders (leitura)
 *   Semana 3: customers (escrita), orders (escrita)
 *   Semana 4: pdv, sales (ÚLTIMO — alto impacto)
 */

export const USE_VPS = {
    // ✅ Já migrados — produção via VPS
    products:    true,
    categories:  true,
    brands:      true,
    versions:    true,  // ✅ migrado de localStorage/Supabase para VPS MySQL em 2026-03-18

    // ✅ Endpoints implementados + dados migrados em 2026-03-18
    banners:     true,
    shipping:    true,
    coupons:     true,
    paymentFees: true,
    company:     true,  // ✅ migrado para VPS MySQL em 2026-03-18

    // ⏳ Alto impacto — deixar para o final
    customers:   false,
    orders:      false,
    pdv:         false,
    sales:       false,
} as const;

export type VpsFeature = keyof typeof USE_VPS;
