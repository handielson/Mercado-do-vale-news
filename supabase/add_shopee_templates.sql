create table if not exists public.shopee_templates (
    id uuid primary key default gen_random_uuid(),
    company_id uuid null references public.companies(id) on delete cascade,
    name text not null,
    active boolean not null default true,
    priority integer not null default 0,
    rules jsonb not null default '{}'::jsonb,
    title_template text not null default '',
    description_template text not null default '',
    shopee_category_id bigint null,
    shopee_category_name text null,
    attribute_defaults jsonb not null default '{}'::jsonb,
    price_mode text not null default 'product',
    fixed_price numeric null,
    price_percent numeric null,
    stock_mode text not null default 'product',
    fixed_stock integer null,
    dimension_mode text not null default 'product',
    weight_kg numeric null,
    package_length numeric null,
    package_width numeric null,
    package_height numeric null,
    gtin_mode text not null default 'product',
    dangerous_terms jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists shopee_templates_company_id_idx on public.shopee_templates(company_id);
create index if not exists shopee_templates_active_idx on public.shopee_templates(active);
create index if not exists shopee_templates_priority_idx on public.shopee_templates(priority desc);
