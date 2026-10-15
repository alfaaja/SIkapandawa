import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = await PGlite.create();
let checks = 0;
const ids = Array.from({length: 6}, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
async function verify(sql, expected, params) { assert.deepEqual((await db.query(sql, params)).rows[0].result, expected); checks++; }
async function login(index, role = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [index === null ? '' : ids[index]]);
    await db.exec(`set role ${role}`);
}
const answers = ['yudhistira', 'bima', 'arjuna', 'nakula', 'sadewa'].flatMap(character => [1,2].map(index => ({cardId: `${character}-0${index}`, basket: 'good'})));
try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create table auth.users(id uuid primary key, created_at timestamptz default now(), raw_user_meta_data jsonb);
        create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth, public to anon, authenticated, service_role;
        grant execute on function auth.uid() to anon, authenticated, service_role;
        alter default privileges in schema public grant all on tables to service_role;`);
    for (const migration of (await fs.readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
        await db.exec(await fs.readFile(`supabase/migrations/${migration}`, 'utf8'));
    }
    for (const [i,id] of ids.entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, {
        display_name: `siswa${i}`, username: `siswa${i}`, normalized_username: `siswa${i}`, school_name: i === 5 ? 'SDN Dua' : 'SDN Kalibanteng Kulon 01'
    }]);
    await db.query('insert into private.admin_users(user_id) values ($1),($2)', [ids[0],ids[4]]);
    for (const i of [1,2]) {
        await login(i);
        for(let level=1;level<=10;level++) await db.query('select public.record_level_result($1::smallint,$2::smallint)', [level,i===1?3:1]);
        await db.query('select public.unlock_jejak_pandawa()');
        await db.query('select public.record_jejak_result($1::smallint)', [i===1?10:7]);
    }
    await login(0);
    const report = (await db.query('select public.admin_school_aspect_averages() result')).rows[0].result;
    assert.equal(report.length,2); checks++;
    const school = report.find(row => row.schoolName==='SDN Kalibanteng Kulon 01');
    assert.equal(school.studentCount,3); checks++;
    assert.equal(school.jejakKnownCount,2); checks++;
    assert.equal(school.aspects.length,5); checks++;
    assert.ok(school.aspects.every(row => Math.abs(row.missionAverage-8/3)<0.000001 && row.jejakAverage===1)); checks++;
    await verify("select jsonb_array_length(public.admin_school_aspect_averages('SDN DUA')) result",1);
    await verify("select public.admin_school_aspect_averages('missing') result",[]);
    await login(3);
    await assert.rejects(db.query('select public.admin_school_aspect_averages()'), /Admin|admin|privilege|denied/); checks++;
    await assert.rejects(db.query('select public.record_jejak_aspect_result($1)', [answers]), /locked/); checks++;
    await login(2);
    for (const invalid of [null, [], [...answers,answers[0]], answers.map(()=>answers[0]), answers.map(a=>({...a,basket:'invalid'})), answers.map(a=>({...a,cardId:'made-up'}))]) {
        await assert.rejects(db.query('select public.record_jejak_aspect_result($1)',[invalid])); checks++;
    }
    await db.query('select public.record_jejak_aspect_result($1)',[answers]);
    await verify('select jejak_pandawa_best_score::int result from public.player_progress where user_id=auth.uid()',7);
    await verify("select jejak_aspect_scores result from public.player_progress where user_id=auth.uid()",{kejujuran:1,keberanian:1,kesopanan:1,kebijaksanaan:1,keadilan:1});
    await db.query('select public.record_jejak_aspect_result($1)',[answers.map(a=>({...a,basket:'bad'}))]);
    await verify("select jejak_aspect_scores result from public.player_progress where user_id=auth.uid()",{kejujuran:1,keberanian:1,kesopanan:1,kebijaksanaan:1,keadilan:1});
    await db.query('update public.player_progress set jejak_aspect_scores=null where user_id=auth.uid()');
    await verify("select jejak_aspect_scores is not null result from public.player_progress where user_id=auth.uid()",true);
    await assert.rejects(db.query("update public.player_progress set jejak_aspect_scores='{}' where user_id=auth.uid()")); checks++;
    await verify('with changed as (update public.player_progress set jejak_aspect_scores=null where user_id=$1 returning user_id) select count(*)::int result from changed',0,[ids[1]]);
    await login(0);
    await verify("select (public.admin_school_aspect_averages('SDN Kalibanteng Kulon 01')->0->>'jejakKnownCount')::int result",3);
    await login(null,'anon');
    await assert.rejects(db.query('select public.admin_school_aspect_averages()')); checks++;
    await assert.rejects(db.query('select public.record_jejak_aspect_result($1)',[answers])); checks++;
    console.log(`PASS: ${checks} character aspect PostgreSQL checks`);
} finally { await db.close(); }
