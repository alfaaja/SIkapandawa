import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
const ids = [1, 2].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
let checks = 0;
const same = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
async function scalar(sql, params) { return (await db.query(sql, params)).rows[0]?.result; }
async function login(n) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[n]]);
    await db.exec('set role authenticated');
}
async function snapshot() {
    return scalar('select to_jsonb(p) result from public.player_progress p where user_id=auth.uid()');
}
const correct = ['yudhistira-01', 'yudhistira-02', 'bima-01', 'bima-02', 'arjuna-01', 'arjuna-02', 'nakula-01', 'nakula-02', 'sadewa-04', 'sadewa-05']
    .map((cardId, i) => ({ cardId, basket: ['good', 'bad', 'bad', 'good', 'bad', 'good', 'good', 'bad', 'bad', 'good'][i] }));
async function submit(id, answers = correct) {
    return scalar('select public.record_jejak_aspect_result_v2($1::uuid,$2::jsonb) result', [id, answers]);
}
try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb);
      create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to service_role;`);
    for (const file of (await fs.readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
        await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
    }
    for (const [i, id] of ids.entries()) {
        await db.exec('reset role');
        await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, {username: 'fixture' + i, normalized_username: 'fixture' + i, display_name: 'Fixture ' + i, school_name: 'Sekolah Fixture'}]);
        await login(i);
        for (let level = 1; level <= 10; level++) await db.query('select public.record_level_result($1::smallint,3::smallint)', [level]);
        await db.exec('select public.unlock_jejak_pandawa(); select public.record_jejak_result(10::smallint)');
    }
    await login(0);
    const before = await snapshot();
    await db.exec('reset role');
    const repair = (await fs.readFile('scripts/sql/correct-jejak-score.template.sql', 'utf8'))
        .replaceAll('__NORMALIZED_USERNAME__', 'fixture0').replaceAll('__SCHOOL_NAME__', 'SEKOLAH FIXTURE')
        .replaceAll('__EXPECTED_SCORE__', '10').replaceAll('__EXPECTED_REVISION__', String(before.revision))
        .replaceAll('__CORRECTED_SCORE__', '9').replaceAll('__REASON__', 'Fixture: source verified by owner');
    // Optimistic checks abort before touching guards/data if the reviewed revision changed.
    await assert.rejects(db.exec(repair.replace(`prior.revision <> ${before.revision}`, 'prior.revision <> -1'))); checks++;
    await db.exec('rollback');
    await db.exec(repair);
    await assert.rejects(db.exec(repair)); checks++;
    await db.exec('rollback');
    // A prior run cannot authorize a replay. Only the fixture operator can supply this past timestamp.
    await db.query(`insert into public.jejak_aspect_runs(id,user_id,answers,aspect_scores,total_score,created_at)
      values($1,$2,$3,private.score_jejak_v2_answers($3),10,'2000-01-01')`, [crypto.randomUUID(), ids[0], correct]);
    await login(0);
    const repaired = await snapshot();
    const existing = await scalar('select id result from public.jejak_aspect_runs limit 1');
    await submit(existing); // retrying a run recorded before the correction does not reopen the cap
    same(await snapshot(), repaired);
    await db.exec('select public.record_jejak_result(10::smallint)');
    same(await snapshot(), repaired); // no score/revision/timestamp churn on stale replay
    await db.exec('update public.player_progress set jejak_pandawa_best_score=10 where user_id=auth.uid()');
    same(await snapshot(), repaired); // direct update cannot bypass the RPC fence
    same(repaired.jejak_aspect_scores, null);
    same(repaired.completed_levels, before.completed_levels);
    same(await scalar('select sum(stars)::int result from public.level_progress'), 30);
    await assert.rejects(db.query('select * from private.jejak_score_corrections')); checks++;
    await assert.rejects(db.query("insert into private.jejak_score_corrections values(auth.uid(),10,'{}','forged',now())")); checks++;
    // Conflict must roll back the update as well as the attempted insert.
    await assert.rejects(submit(existing, correct.map(a => ({...a, basket: a.basket === 'good' ? 'bad' : 'good'})))); checks++;
    same(await snapshot(), repaired);
    const freshId = crypto.randomUUID();
    same((await submit(freshId)).total, 10);
    same((await snapshot()).jejak_pandawa_best_score, 10);
    await submit(freshId);
    same(await scalar('select count(*)::int result from public.jejak_aspect_runs'), 2);
    // The other account continues to use normal legacy synchronization.
    await login(1);
    await db.exec('select public.record_jejak_result(10::smallint)');
    same((await snapshot()).jejak_pandawa_best_score, 10);
    same(await scalar('select sum(stars)::int result from public.level_progress'), 30);
    await db.exec('reset role');
    same(await scalar("select count(*)::int result from pg_trigger where tgrelid='public.player_progress'::regclass and not tgisinternal and tgenabled='O'"), 3);
    same(await scalar('select before_progress result from private.jejak_score_corrections where user_id=$1', [ids[0]]), before);
    console.log(`PASS: ${checks} Jejak correction PostgreSQL checks`);
} catch (error) {
    console.error('FAIL:', error.message);
    process.exitCode = 1;
} finally { await db.close(); }
