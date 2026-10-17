begin;

-- Operator-only audit. This migration changes no student scores.
create table private.jejak_score_corrections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  corrected_score smallint not null check (corrected_score between 0 and 10),
  before_progress jsonb not null check (jsonb_typeof(before_progress) = 'object'),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  corrected_at timestamptz not null default clock_timestamp()
);
alter table private.jejak_score_corrections enable row level security;
revoke all on private.jejak_score_corrections from public, anon, authenticated, service_role;
comment on table private.jejak_score_corrections is
  'Operator-verified historical total corrections. No invented answers/aspects. Browser roles have no access.';

create function private.guard_corrected_jejak_total()
returns trigger language plpgsql security definer set search_path = '' as $$
declare correction private.jejak_score_corrections; verified_best smallint;
begin
  if new.jejak_pandawa_best_score <= old.jejak_pandawa_best_score then return new; end if;
  select * into correction from private.jejak_score_corrections c where c.user_id = old.user_id;
  if not found then return new; end if;
  select max(r.total_score) into verified_best from public.jejak_aspect_runs r
   where r.user_id = old.user_id and r.curriculum_version = 2 and r.created_at > correction.corrected_at;
  -- A cached legacy total is acknowledged without increasing the score or blocking its queue.
  new.jejak_pandawa_best_score := least(new.jejak_pandawa_best_score,
    greatest(old.jejak_pandawa_best_score, correction.corrected_score, coalesce(verified_best, 0)));
  return new;
end $$;
revoke all on function private.guard_corrected_jejak_total() from public, anon, authenticated, service_role;
-- Alphabetical trigger ordering places this before the existing monotonic/revision guard.
create trigger player_progress_00_guard_corrected_jejak_total
before update on public.player_progress for each row execute function private.guard_corrected_jejak_total();

create or replace function public.record_jejak_aspect_result_v2(submission_id uuid, run_answers jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare scores jsonb; total smallint; saved public.jejak_aspect_runs;
begin
  if (select auth.uid()) is null or (select private.is_admin()) then
    raise exception using errcode = '42501', message = 'Student account required';
  end if;
  if submission_id is null then raise exception using errcode = '22023', message = 'Submission ID required'; end if;
  scores := private.score_jejak_v2_answers(run_answers);
  select sum(value::integer)::smallint into total from jsonb_each_text(scores);
  -- RLS enforces own unlocked account; CHECK enforces the actual server-derived answer key.
  -- Insert before updating the total so a genuine post-correction run can raise the best again.
  insert into public.jejak_aspect_runs(id, user_id, answers, aspect_scores, total_score)
  values(submission_id, (select auth.uid()), run_answers, scores, total) on conflict(id) do nothing;
  select * into saved from public.jejak_aspect_runs r where r.id = submission_id and r.user_id = (select auth.uid());
  if saved.id is null or saved.answers is distinct from run_answers then
    raise exception using errcode = '22023', message = 'Submission ID already used';
  end if;
  perform public.record_jejak_result(total);
  return jsonb_build_object('id', saved.id, 'version', saved.curriculum_version, 'scores', saved.aspect_scores, 'total', saved.total_score);
end $$;

notify pgrst, 'reload schema';
commit;
