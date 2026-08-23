alter table public.profiles        enable row level security;
alter table public.level_progress  enable row level security;
alter table public.questions       enable row level security;
alter table public.minigame_cards  enable row level security;
alter table public.minigame_result enable row level security;

-- profiles: hanya milik sendiri
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- level_progress: full CRUD milik sendiri
create policy "lp_all_own" on public.level_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- minigame_result: full CRUD milik sendiri
create policy "mr_all_own" on public.minigame_result
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- konten read-only untuk user login
create policy "questions_read" on public.questions
  for select to authenticated using (true);
create policy "cards_read" on public.minigame_cards
  for select to authenticated using (true);
