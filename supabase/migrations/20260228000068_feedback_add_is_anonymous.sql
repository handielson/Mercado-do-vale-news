-- Migration: Add missing is_anonymous column to customer_feedbacks
-- The FeedbackModal sends is_anonymous field but the table was created without it.

ALTER TABLE public.customer_feedbacks
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT true;
