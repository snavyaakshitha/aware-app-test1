-- 0008: Community photo submissions for unknown products.
-- Users can submit front + label photos for products not in any database.

create table if not exists public.community_submissions (
  id               uuid        primary key default gen_random_uuid(),
  barcode          text        not null,
  user_id          uuid        references auth.users(id) on delete set null,
  front_image_url  text,
  label_image_url  text,
  status           text        not null default 'pending'
                   check (status in ('pending', 'reviewed', 'merged', 'rejected')),
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists community_submissions_barcode_idx on public.community_submissions (barcode);
create index if not exists community_submissions_status_idx  on public.community_submissions (status);

alter table public.community_submissions enable row level security;

drop policy if exists "Anyone can submit community photos" on public.community_submissions;
create policy "Anyone can submit community photos"
  on public.community_submissions for insert
  with check (true);

drop policy if exists "Users see own submissions" on public.community_submissions;
create policy "Users see own submissions"
  on public.community_submissions for select
  using (user_id = auth.uid() or user_id is null);

drop policy if exists "Service role full access community" on public.community_submissions;
create policy "Service role full access community"
  on public.community_submissions for all
  to service_role
  using (true) with check (true);

-- Storage bucket (run separately if storage extension not available in migration runner)
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values ('community-submissions', 'community-submissions', false, 10485760,
--         ARRAY['image/jpeg','image/png','image/webp','image/heic'])
-- on conflict (id) do nothing;
