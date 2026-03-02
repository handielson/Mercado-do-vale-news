-- Torna hire_date opcional na tabela team_members
-- Freelancers e PJ não têm necessariamente uma data formal de contratação

ALTER TABLE team_members ALTER COLUMN hire_date DROP NOT NULL;
