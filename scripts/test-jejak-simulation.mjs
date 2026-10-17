import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = await PGlite.create(); let checks = 0;
const ids = [1,2,3].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
async function scalar(sql,p){return (await db.query(sql,p)).rows[0]?.result;}
async function login(i,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);await db.exec(`set role ${role}`);}
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function denied(p){await assert.rejects(p);checks++;}
const answers = ['yudhistira-01','yudhistira-02','bima-01','bima-02','arjuna-01','arjuna-02','nakula-01','nakula-02','sadewa-04','sadewa-05']
 .map((cardId,i)=>({cardId,basket:['bad','bad','bad','good','bad','good','good','bad','bad','good'][i]}));
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb);
 create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;`);
 for(const f of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile('supabase/migrations/'+f,'utf8'));
 for(const [i,id] of ids.entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:'fixture'+i,normalized_username:'fixture'+i,display_name:'Fixture '+i,school_name:i===2?'Sekolah Dua':'Sekolah Satu'}]);
 await db.query('insert into private.admin_users(user_id) values($1)',[ids[0]]);
 const before=await scalar("select md5(jsonb_agg(to_jsonb(p) order by user_id)::text) result from public.player_progress p");
 for(const id of ids.slice(1))await db.query(`insert into public.jejak_simulated_results(user_id,source_key,source_label,source_total,answers,aspect_scores)
 values($1,'source','Rekap sumber',9,$2,private.score_jejak_v2_answers($2))`,[id,answers]);
 eq(await scalar('select count(*)::int result from public.jejak_aspect_runs'),0);
 eq(await scalar("select md5(jsonb_agg(to_jsonb(p) order by user_id)::text) result from public.player_progress p"),before);
 await denied(db.query(`insert into public.jejak_simulated_results(user_id,source_key,source_label,source_total,answers,aspect_scores)
 values($1,'wrong','Source',10,$2,private.score_jejak_v2_answers($2))`,[ids[1],answers]));
 await login(1);eq(await scalar('select count(*)::int result from public.jejak_simulated_results'),0);
 await denied(db.exec('select public.admin_jejak_simulation()'));
 await denied(db.query(`insert into public.jejak_simulated_results(user_id,source_key,source_label,source_total,answers,aspect_scores) values(auth.uid(),'forged','Source',9,$1,private.score_jejak_v2_answers($1))`,[answers]));
 await denied(db.exec('update public.jejak_simulated_results set source_total=10'));
 await denied(db.exec('delete from public.jejak_simulated_results'));
 await login(0);
 const report=await scalar('select public.admin_jejak_simulation() result');
 eq(report.length,2);eq(report[0].provenance,'simulated');eq(report[0].studentCount,1);
 eq(report[0].aspects.map(a=>a.jejakAverage),[1,2,2,2,2]);
 eq(report[0].students[0].total,9);eq(report[0].students[0].scores.kejujuran,1);
 eq((await scalar("select public.admin_jejak_simulation('SEKOLAH DUA') result")).length,1);
 eq((await scalar("select public.admin_jejak_simulation('SEKOLAH KOSONG') result")).length,0);
 await denied(db.exec('delete from public.jejak_simulated_results'));
 await login(null,'anon');await denied(db.exec('select public.admin_jejak_simulation()'));
 if(process.argv[2] && process.argv[3]) {
  const manifest=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
  const sql=await fs.readFile(process.argv[3],'utf8');
  await db.exec('reset role');
  for(const [i,r] of manifest.records.entries()) {
   const id=crypto.randomUUID();
   await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:r.username,normalized_username:r.username,display_name:'Import Fixture '+i,school_name:r.school}]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
   for(let level=1;level<=10;level++)await db.query('select public.record_level_result($1::smallint,3::smallint)',[level]);
   await db.exec('select public.unlock_jejak_pandawa()');
   await db.query('select public.record_jejak_result($1::smallint)',[r.sourceTotal]);
  }
  const hash=await scalar('select md5(jsonb_agg(to_jsonb(p) order by user_id)::text) result from public.player_progress p');
  await db.exec(sql);await db.exec(sql);
  eq(await scalar("select count(*)::int result from public.jejak_simulated_results where source_key='pkm-rekap-20261016'"),21);
  eq(await scalar("select sum(source_total)::int result from public.jejak_simulated_results where source_key='pkm-rekap-20261016'"),192);
  eq(await scalar('select md5(jsonb_agg(to_jsonb(p) order by user_id)::text) result from public.player_progress p'),hash);
  await denied(db.exec(sql.replace('"sourceTotal":7','"sourceTotal":8')));await db.exec('rollback');
  eq(await scalar("select sum(source_total)::int result from public.jejak_simulated_results where source_key='pkm-rekap-20261016'"),192);
 }
 console.log(`PASS: ${checks} labeled Jejak simulation PostgreSQL checks`);
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}finally{await db.close();}
