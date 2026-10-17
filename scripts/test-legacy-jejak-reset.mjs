import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
const ids = Array.from({ length: 5 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
let checks = 0;
const same = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const scalar = async (sql, params) => (await db.query(sql, params)).rows[0]?.result;
async function login(index) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[index]]);
    await db.exec('set role authenticated');
}
const cards = ['yudhistira-01','yudhistira-02','bima-01','bima-02','arjuna-01','arjuna-02','nakula-01','nakula-02','sadewa-04','sadewa-05'];
const answers = cards.map((cardId, index) => ({ cardId, basket: ['good','bad','bad','good','bad','good','good','bad','bad','good'][index] }));
try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb);
      create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to service_role;`);
    for (const file of (await fs.readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort()) {
        await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
    }
    for (const [index, id] of ids.entries()) {
        await db.exec('reset role');
        await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username: `fixture${index}`, normalized_username: `fixture${index}`, display_name: `Fixture ${index}`, school_name: 'Sekolah Fixture' }]);
        await login(index);
        for (let level=1; level<=10; level++) await db.query('select public.record_level_result($1::smallint,3::smallint)', [level]);
        await db.exec('select public.unlock_jejak_pandawa(); select public.record_jejak_result(10::smallint)');
        if ([2,3].includes(index)) await db.query('select public.record_jejak_aspect_result_v2($1,$2)', [crypto.randomUUID(), answers]);
    }
    await db.exec('reset role');
    await db.query('insert into private.admin_users(user_id) values($1)', [ids[4]]);
    await db.query(`insert into private.jejak_score_corrections(user_id,corrected_score,before_progress,reason)
      select user_id,9,to_jsonb(p),'Prior verified correction' from public.player_progress p where user_id=$1`, [ids[0]]);
    const before = await scalar('select jsonb_agg(to_jsonb(p) order by user_id) result from public.player_progress p');
    const originalAudit = await scalar('select before_progress result from private.jejak_score_corrections');
    const hash = async (table, order) => scalar(`select md5(coalesce(jsonb_agg(to_jsonb(x) order by ${order}),'[]'::jsonb)::text) result from ${table} x`);
    let sql = await fs.readFile('scripts/sql/reset-legacy-jejak.template.sql','utf8');
    sql = sql.replaceAll('__PROGRESS_HASH__', await hash('public.player_progress','user_id'))
        .replaceAll('__RUNS_HASH__', await hash('public.jejak_aspect_runs','id'))
        .replaceAll('__CORRECTIONS_HASH__', await hash('private.jejak_score_corrections','user_id'))
        .replaceAll('__TARGET_COUNT__','2');
    await assert.rejects(db.exec(sql.replace("<> 2 then", "<> -1 then"))); checks++;
    await db.exec('rollback');
    same(await scalar('select jsonb_agg(to_jsonb(p) order by user_id) result from public.player_progress p'), before);
    await db.exec(sql);
    const after = await scalar('select jsonb_agg(to_jsonb(p) order by user_id) result from public.player_progress p');
    same(after.map(p => p.jejak_pandawa_best_score), [0,0,10,10,10]);
    same(after.slice(2), before.slice(2));
    for (let i=0;i<2;i++) {
        same(after[i].revision, before[i].revision+1);
        same(after[i].completed_levels, before[i].completed_levels);
        same(after[i].jejak_pandawa_unlocked, true);
        same(after[i].jejak_aspect_scores, null);
        await login(i);
        await db.exec('select public.record_jejak_result(10::smallint)');
        same(await scalar('select jejak_pandawa_best_score::int result from public.player_progress where user_id=auth.uid()'),0);
        await db.exec('reset role');
    }
    same(await scalar('select sum(stars)::int result from public.level_progress'),150);
    same(await scalar('select count(*)::int result from public.jejak_aspect_runs'),2);
    same(await scalar('select before_progress result from private.jejak_score_corrections where user_id=$1',[ids[0]]),originalAudit);
    same(await scalar("select count(*)::int result from pg_trigger where tgrelid='public.player_progress'::regclass and not tgisinternal and tgenabled='O'"),3);
    await assert.rejects(db.exec(sql)); checks++;
    await db.exec('rollback');
    await login(0);
    await db.query('select public.record_jejak_aspect_result_v2($1,$2)',[crypto.randomUUID(),answers]);
    same(await scalar('select jejak_pandawa_best_score::int result from public.player_progress where user_id=auth.uid()'),10);
    console.log(`PASS: ${checks} legacy Jejak reset PostgreSQL checks`);
} catch (error) {
    console.error('FAIL:',error.message);
    process.exitCode=1;
} finally { await db.close(); }
