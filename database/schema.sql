-- Football World Chronicle: proposed Neon/PostgreSQL schema
-- The browser prototype currently uses localStorage. This schema is the migration target.

create extension if not exists pgcrypto;

create table worlds (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  name text not null,
  current_season integer not null,
  simulation_date date not null,
  current_week integer not null default 0,
  rng_seed bigint not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table countries (
  id text primary key,
  name text not null,
  confederation text not null,
  simulation_tier smallint not null check (simulation_tier in (1,2))
);

  create table leagues (
    id text primary key,
    country_id text not null references countries(id),
    name text not null,
    tier smallint not null,
    format_config jsonb not null default '{}'::jsonb
  );

create table clubs (
  id text primary key,
  league_id text not null references leagues(id),
  name text not null,
  city text,
  base_strength smallint not null,
  created_at timestamptz not null default now()
);

create table world_clubs (
  world_id uuid not null references worlds(id) on delete cascade,
  club_id text not null references clubs(id),
  strength smallint not null,
  reputation numeric(5,2) not null,
  fans bigint not null,
  finances numeric(14,2) not null,
  form numeric(5,2) not null default 0,
  primary key (world_id, club_id)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  club_id text references clubs(id),
  nationality_id text not null references countries(id),
  name text not null,
  birth_year integer not null,
  position text not null check (position in ('GK','DF','MF','FW')),
  role text not null,
  rating smallint not null,
  potential smallint not null,
  fame smallint not null,
  status text not null default 'active' check (status in ('active','retired')),
  is_national_specialist boolean not null default false
);

create index players_world_club_idx on players(world_id, club_id);
create index players_world_nationality_idx on players(world_id, nationality_id);

create table competition_editions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  competition_code text not null,
  season integer not null,
  name text not null,
  stage text not null,
  status text not null check (status in ('scheduled','active','complete','compacted')),
  format_config jsonb not null,
  champion_team_id text,
  runner_up_team_id text,
  is_international boolean not null default false,
  unique(world_id, competition_code, season)
);

-- LIVE CURRENT-SEASON TABLES: deleted after successful compaction.
create table live_matches (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  edition_id uuid not null references competition_editions(id) on delete cascade,
  season integer not null,
  week integer not null,
  played_on date not null,
  stage text,
  home_team_id text not null,
  away_team_id text not null,
  home_goals smallint not null,
  away_goals smallint not null,
  winner_team_id text,
  penalties_home smallint,
  penalties_away smallint,
  is_international boolean not null default false,
  is_landmark boolean not null default false
);

create index live_matches_world_week_idx on live_matches(world_id, week);
create index live_matches_edition_idx on live_matches(edition_id);

create table live_player_match_stats (
  match_id uuid not null references live_matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  team_id text not null,
  opponent_id text not null,
  started boolean not null default true,
  goals smallint not null default 0,
  assists smallint not null default 0,
  clean_sheet boolean not null default false,
  rating numeric(4,2) not null,
  man_of_match boolean not null default false,
  primary key (match_id, player_id)
);

create table live_tables (
  world_id uuid not null references worlds(id) on delete cascade,
  edition_id uuid not null references competition_editions(id) on delete cascade,
  team_id text not null,
  played smallint not null default 0,
  wins smallint not null default 0,
  draws smallint not null default 0,
  losses smallint not null default 0,
  goals_for smallint not null default 0,
  goals_against smallint not null default 0,
  points smallint not null default 0,
  form text[] not null default '{}',
  primary key (edition_id, team_id)
);

create table live_news (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  season integer not null,
  week integer not null,
  importance text not null,
  category text not null,
  headline text not null,
  body text not null,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

-- PERMANENT COMPACT HISTORY.
create table player_competition_seasons (
  world_id uuid not null references worlds(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  season integer not null,
  competition_code text not null,
  team_id text not null,
  is_international boolean not null default false,
  appearances smallint not null,
  starts smallint not null,
  goals smallint not null,
  assists smallint not null,
  clean_sheets smallint not null,
  average_rating numeric(4,2) not null,
  man_of_match smallint not null default 0,
  primary key (world_id, player_id, season, competition_code)
);

create index player_history_lookup_idx on player_competition_seasons(world_id, player_id, season desc);

create table club_league_seasons (
  world_id uuid not null references worlds(id) on delete cascade,
  club_id text not null references clubs(id),
  league_id text not null references leagues(id),
  season integer not null,
  final_position smallint not null,
  played smallint not null,
  wins smallint not null,
  draws smallint not null,
  losses smallint not null,
  goals_for smallint not null,
  goals_against smallint not null,
  points smallint not null,
  primary key (world_id, club_id, season, league_id)
);

create table champions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  season integer not null,
  competition_code text not null,
  competition_name text not null,
  winner_team_id text not null,
  runner_up_team_id text,
  is_international boolean not null default false,
  unique(world_id, season, competition_code)
);

create table awards (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  season integer not null,
  award_name text not null,
  player_id uuid not null references players(id),
  competition_code text,
  finishing_rank smallint not null default 1,
  score numeric(10,3),
  unique(world_id, season, award_name, player_id, finishing_rank)
);

create index award_winner_lookup_idx on awards(world_id, award_name, finishing_rank, season desc);

create table player_honours (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  season integer not null,
  player_id uuid not null references players(id),
  competition_code text not null,
  competition_name text not null,
  team_id text not null,
  is_international boolean not null default false
);

create table landmark_matches (
  id uuid primary key,
  world_id uuid not null references worlds(id) on delete cascade,
  season integer not null,
  competition_code text not null,
  competition_name text not null,
  stage text not null,
  home_team_id text not null,
  away_team_id text not null,
  home_goals smallint not null,
  away_goals smallint not null,
  winner_team_id text,
  penalties_home smallint,
  penalties_away smallint,
  is_international boolean not null default false
);

create table season_reviews (
  world_id uuid not null references worlds(id) on delete cascade,
  season integer not null,
  review_json jsonb not null,
  primary key (world_id, season)
);

create table simulation_jobs (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id) on delete cascade,
  target_type text not null check (target_type in ('week','month','season_end')),
  target_week integer,
  status text not null check (status in ('queued','running','complete','failed')),
  processed_fixtures integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
