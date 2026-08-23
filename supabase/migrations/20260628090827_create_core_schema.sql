-- PROFIL
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  created_at timestamptz default now()
);

-- PROGRES LEVEL
create table public.level_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level int not null check (level between 1 and 15),
  stars int not null default 0 check (stars between 0 and 3),
  completed boolean not null default false,
  updated_at timestamptz default now(),
  unique (user_id, level)
);

-- BANK SOAL STUDI KASUS (3 per level x 15 = 45 baris)
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  level int not null check (level between 1 and 15),
  character text,
  scenario text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  correct_option char(1) not null check (correct_option in ('A','B','C')),
  explanation text
);

-- KARTU MINI-GAME (>= 20 baris)
create table public.minigame_cards (
  id uuid primary key default gen_random_uuid(),
  scenario text not null,
  correct_basket text not null check (correct_basket in ('baik','buruk'))
);

-- HASIL MINI-GAME
create table public.minigame_result (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  benar int not null,
  salah int not null,
  played_at timestamptz default now()
);
