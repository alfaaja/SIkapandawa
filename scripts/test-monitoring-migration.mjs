import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = await PGlite.create();
const ids = Array.from({length:5},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
let checks=0;
async function value(query,params) { return (await db.query(query,params)).rows[0]?.result; }
function verify(actual,expected) { assert.deepEqual(actual,expected); checks++; }
async function login(i,role='authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);
    await db.exec(`set role ${role}`);
}
const scores = n => ({kejujuran:n,keberanian:null,kesopanan:n,kebijaksanaan:n,keadilan:n});
async function submit(id,point=1,ratings=scores(4),situation='Berbagi dengan saudara') {
    return value('select public.submit_parent_monitoring($1::uuid,$2::integer,$3::timestamptz,$4,$5,$6,$7,$8,$9) result',
        [id,point,'2026-10-15T12:00:00Z','Orang tua siswa','V A',situation,'Anak menunggu giliran.','Diberi apresiasi.',ratings]);
}
try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create table auth.users(id uuid primary key, created_at timestamptz default now(),raw_user_meta_data jsonb);
        create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema auth,public to anon,authenticated,service_role;
        grant execute on function auth.uid() to anon,authenticated,service_role;
        alter default privileges in schema public grant all on tables to service_role;`);
    for(const file of (await fs.readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()) await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
    for(const [i,id] of ids.entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{
        display_name:'siswa'+i,username:'siswa'+i,normalized_username:'siswa'+i,school_name:i===3?'SDN Dua':'SDN Kalibanteng Kulon 01'}]);
    await db.query('insert into private.admin_users(user_id) values($1),($2)',[ids[0],ids[4]]);
    await login(1);
    const before=await value('select public.read_complete_progress() result');
    verify((await value('select public.parent_monitoring_context() result')).completedPoints,[]);
    const first=crypto.randomUUID();
    await submit(first);
    await submit(first);
    verify((await value('select public.monitoring_history() result')).total,1);
    await assert.rejects(submit(first,1,scores(1)),/already used/);checks++;
    await submit(crypto.randomUUID(),1,scores(2));
    await submit(crypto.randomUUID(),2,scores(null));
    verify((await value('select public.monitoring_history() result')).total,3);
    verify((await value('select public.parent_monitoring_context() result')).completedPoints,[1,2]);
    verify(await value('select public.read_complete_progress() result'),before);
    for(const invalid of [null,{}, {...scores(3),kejujuran:0},{...scores(3),kejujuran:5},{...scores(3),kejujuran:'4'}]) {
        await assert.rejects(submit(crypto.randomUUID(),1,invalid));checks++;
    }
    for(const point of [0,13,null]) { await assert.rejects(submit(crypto.randomUUID(),point));checks++; }
    await assert.rejects(submit(crypto.randomUUID(),1,scores(3),''));checks++;
    await assert.rejects(db.query("update public.parent_monitoring_observations set guardian_name='changed'"));checks++;
    await assert.rejects(db.query('delete from public.parent_monitoring_observations'));checks++;
    await assert.rejects(db.query('select public.admin_monitoring_summary()'));checks++;
    await assert.rejects(db.query('select public.monitoring_history($1)',[ids[2]]));checks++;
    const page1=await value('select public.monitoring_history(null,2,0) result');
    const page2=await value('select public.monitoring_history(null,2,2) result');
    verify(page1.items.length,2);verify(page2.items.length,1);
    verify(new Set([...page1.items,...page2.items].map(e=>e.id)).size,3);
    await login(2);
    verify(await value('select count(*)::int result from public.parent_monitoring_observations'),0);
    await submit(crypto.randomUUID(),1,{...scores(1),keberanian:4});
    await login(0);
    await assert.rejects(submit(crypto.randomUUID()));checks++;
    await assert.rejects(db.query('select public.parent_monitoring_context()'));checks++;
    const reports=await value('select public.admin_monitoring_summary() result');
    verify(reports.length,2);
    const school=reports.find(s=>s.schoolName==='SDN Kalibanteng Kulon 01');
    verify(school.studentCount,2);verify(school.participantCount,2);verify(school.points.length,12);
    verify(school.points[0].aspects.find(a=>a.id==='kejujuran'),{id:'kejujuran',average:2,studentCount:2});
    verify(school.points[0].aspects.find(a=>a.id==='keberanian'),{id:'keberanian',average:4,studentCount:1});
    verify(school.points[1].aspects.every(a=>a.average===null&&a.studentCount===0),true);
    verify((await value('select public.monitoring_history($1) result',[ids[1]])).total,3);
    verify((await value("select public.admin_monitoring_summary('SDN DUA') result")).length,1);
    verify(await value("select public.admin_monitoring_summary('unknown') result"),[]);
    const individual=await value('select public.admin_monitoring_summary(null,$1) result',[ids[1]]);
    verify(individual[0].studentCount,1);verify(individual[0].points[0].aspects[0].average,3);
    await login(null,'anon');
    for(const query of ['select public.parent_monitoring_context()','select public.monitoring_history()','select public.admin_monitoring_summary()']) {
        await assert.rejects(db.query(query));checks++;
    }
    await assert.rejects(submit(crypto.randomUUID()));checks++;
    console.log('PASS: '+checks+' monitoring PostgreSQL checks');
} catch(error) { console.error(error.message); if(error.where) console.error(error.where); process.exitCode=1; }
finally { await db.close(); }
