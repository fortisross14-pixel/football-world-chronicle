-- Required by Football World Chronicle v0.4 cloud Save/Load.
create extension if not exists pgcrypto;

create table if not exists cloud_saves (
  id uuid primary key default gen_random_uuid(),
  save_key text not null unique,
  save_name text not null default 'Main Universe',
  current_season integer,
  game_data jsonb not null,
  updated_at timestamptz not null default now()
);
