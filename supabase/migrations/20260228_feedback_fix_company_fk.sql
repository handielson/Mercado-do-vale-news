-- Migration: Fix customer_feedbacks company_id FK
-- O projeto migrou de `companies` para `company_settings` com IDs diferentes.
-- A solução segura é remover a FK (que bloqueia insert) sem recriar,
-- mantendo company_id como UUID livre para rastreamento.

-- Remove a FK antiga que apontava para companies(id)
ALTER TABLE public.customer_feedbacks
    DROP CONSTRAINT IF EXISTS customer_feedbacks_company_id_fkey;
