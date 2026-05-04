-- 0007: Ensure cached_products table exists and supports USDA-seeded data.
-- The seed-usda-products Edge Function upserts rows into this table.

create table if not exists public.cached_products (
  barcode           text        primary key,
  product_name      text,
  brand             text,
  ingredients       text[]      default '{}',
  nutrition_facts   jsonb,
  source            text        not null default 'usda_fdc',
  category          text        not null default 'food',
  image_front_url   text,
  image_label_url   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index for fast barcode lookups
create index if not exists cached_products_barcode_idx on public.cached_products (barcode);

-- RLS: anonymous reads allowed (product data is public), writes require service role
alter table public.cached_products enable row level security;

drop policy if exists "Anyone can read cached products" on public.cached_products;
create policy "Anyone can read cached products"
  on public.cached_products
  for select
  using (true);

-- Service role can insert/update (used by the seeding Edge Function)
drop policy if exists "Service role can upsert cached products" on public.cached_products;
create policy "Service role can upsert cached products"
  on public.cached_products
  for all
  to service_role
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function public.set_cached_products_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cached_products_updated_at on public.cached_products;
create trigger cached_products_updated_at
  before update on public.cached_products
  for each row execute function public.set_cached_products_updated_at();
