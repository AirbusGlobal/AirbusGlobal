-- AirBus Kenya: listings, roles, storage. Run in the Supabase SQL editor.
create type app_role as enum ('admin','owner','guest');

create table if not exists user_roles (
  user_id uuid references auth.users on delete cascade,
  role app_role not null,
  primary key (user_id, role)
);
alter table user_roles enable row level security;

create or replace function has_role(_user uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from user_roles where user_id = _user and role = _role) $$;

create policy "read own roles" on user_roles for select using (user_id = auth.uid() or has_role(auth.uid(),'admin'));
create policy "admins manage roles" on user_roles for all using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  video_url text,
  thumbnail_url text,
  images text[] default '{}',
  price_per_night integer not null check (price_per_night > 0),
  currency text default 'KES',
  location text not null,
  area text,
  city text default 'Nairobi',
  bedrooms integer,
  bathrooms integer,
  guests integer default 2,
  type text,
  amenities text[] default '{}',
  description text,
  source_name text not null default 'Direct',
  source_url text,
  affiliate_link text not null,
  host_whatsapp text,
  host_id uuid references auth.users,
  is_featured boolean default false,
  is_video_verified boolean default false,
  views integer default 0,
  created_at timestamptz default now()
);
alter table listings enable row level security;

create policy "public read listings" on listings for select using (true);
create policy "owners insert own" on listings for insert
  with check (host_id = auth.uid() and (has_role(auth.uid(),'owner') or has_role(auth.uid(),'admin')));
create policy "owners update own" on listings for update
  using (host_id = auth.uid() or has_role(auth.uid(),'admin'));
create policy "owners delete own" on listings for delete
  using (host_id = auth.uid() or has_role(auth.uid(),'admin'));
-- Only admins may change is_featured / is_video_verified: enforce in a trigger or edge function.

insert into storage.buckets (id, name, public) values ('listing-videos','listing-videos',true) on conflict (id) do nothing;
create policy "public read videos" on storage.objects for select using (bucket_id = 'listing-videos');
create policy "owners upload videos" on storage.objects for insert
  with check (bucket_id = 'listing-videos' and auth.uid()::text = (storage.foldername(name))[1]);
