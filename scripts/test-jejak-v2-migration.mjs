import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { build } from 'esbuild';
const db=await PGlite.create(); let checks=0;
const ids=Array.from({length:4},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
async function value(sql,params){return (await db.query(sql,params)).rows[0]?.result;}
function verify(actual,expected){assert.deepEqual(actual,expected);checks++;}
async function denied(action){await assert.rejects(action);checks++;}
async function login(i,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);await db.exec(`set role ${role}`);}
const cards=['yudhistira-01','yudhistira-02','bima-01','bima-02','arjuna-01','arjuna-02','nakula-01','nakula-02','sadewa-04','sadewa-05'];
const pattern=['good','bad','good','bad','bad','bad','good','bad','bad','bad'];
const answers=cards.map((cardId,i)=>({cardId,basket:pattern[i]}));
async function submit(id,items=answers){return value('select public.record_jejak_aspect_result_v2($1::uuid,$2::jsonb) result',[id,items]);}
async function summary(){return value('select public.admin_school_aspect_averages_v2() result');}
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb);
 create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;`);
 for(const file of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 const bundle=await build({entryPoints:['src/game/data/jejakPandawa.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.DEV':'false'}});
 const {JEJAK_CARDS}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 verify((await db.query('select card_id,aspect,good from private.jejak_v2_cards() order by card_id')).rows,
  JEJAK_CARDS.map(card=>({card_id:card.id,aspect:card.aspect,good:card.isGood})).sort((a,b)=>a.card_id.localeCompare(b.card_id)));
 for(const [i,id] of ids.entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:'siswa'+i,normalized_username:'siswa'+i,display_name:'Siswa '+i,school_name:i===3?'Sekolah Dua':'Sekolah Satu'}]);
 await db.query('insert into private.admin_users(user_id) values($1)',[ids[0]]);
 for(const i of [1,2]){await login(i);for(let level=1;level<=10;level++)await db.query('select public.record_level_result($1::smallint,$2::smallint)',[level,i===1?3:1]);await db.query('select public.unlock_jejak_pandawa()');await db.query('select public.record_jejak_result($1::smallint)',[i===1?10:7]);}
 await login(0);
 const before=await summary();
 const school=before.find(s=>s.schoolName==='SEKOLAH SATU');
 verify(school.jejakVersion,2);verify(school.jejakKnownCount,0);verify(school.aspects.map(a=>a.jejakAverage),[null,null,null,null,null]);
 const mission=school.aspects.map(a=>a.missionAverage);
 await login(3);await denied(submit(crypto.randomUUID()));
 await login(1);await denied(db.query('select public.admin_school_aspect_averages_v2()'));
 const id=crypto.randomUUID(); const receipt=await submit(id);
 verify(receipt.scores,{kejujuran:2,keberanian:0,kesopanan:1,kebijaksanaan:2,keadilan:1});
 await submit(id);verify(await value('select count(*)::int result from public.jejak_aspect_runs'),1);
 await denied(submit(id,answers.map(a=>({...a,basket:'good'}))));
 for(const bad of [null,[],answers.slice(1),answers.map(()=>answers[0]),answers.map(a=>({...a,basket:'invalid'})),answers.map(a=>({...a,extra:'ignored?'})),answers.map(a=>({...a,cardId:a.cardId==='sadewa-04'?'sadewa-01':a.cardId}))])await denied(submit(crypto.randomUUID(),bad));
 await denied(db.query('update public.jejak_aspect_runs set total_score=10'));
 await denied(db.query('delete from public.jejak_aspect_runs'));
 await denied(db.query('insert into public.jejak_aspect_runs(id,user_id,answers,aspect_scores,total_score) values($1,$2,$3,$4,10)',[crypto.randomUUID(),ids[1],answers,{kejujuran:2,keberanian:2,kesopanan:2,kebijaksanaan:2,keadilan:2}]));
 await denied(db.query('insert into public.jejak_aspect_runs(id,user_id,answers,aspect_scores,total_score,created_at) values($1,$2,$3,$4,6,now())',[crypto.randomUUID(),ids[1],answers,receipt.scores]));
 verify(await value('select jejak_pandawa_best_score::int result from public.player_progress where user_id=auth.uid()'),10);
 verify(await value('select count(*)::int result from public.level_progress where stars=3'),10);
 await login(2);verify(await value('select count(*)::int result from public.jejak_aspect_runs'),0);
 await denied(submit(id));
 await submit(crypto.randomUUID(),answers.map(a=>({...a,basket:'good'})));
 await login(0);const after=(await summary()).find(s=>s.schoolName==='SEKOLAH SATU');
 verify(after.jejakKnownCount,2);verify(after.aspects.map(a=>a.missionAverage),mission);
 verify(after.aspects.map(a=>a.jejakAverage),[1.5,0.5,1,1.5,1]);
 await login(1);await submit(crypto.randomUUID(),answers.map(a=>({...a,basket:'bad'})));
 await login(0);verify((await summary()).find(s=>s.schoolName==='SEKOLAH SATU').aspects.map(a=>a.jejakAverage),[1.5,1,1,1.5,1]);
 await denied(submit(crypto.randomUUID()));
 await login(null,'anon');await denied(db.query('select public.admin_school_aspect_averages_v2()'));await denied(submit(crypto.randomUUID()));
 console.log(`PASS: ${checks} Jejak v2 PostgreSQL checks`);
} catch(error) {console.error('FAIL:',error.message);process.exitCode=1;} finally {await db.close();}
