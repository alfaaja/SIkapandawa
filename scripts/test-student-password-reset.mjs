import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=await PGlite.create();let checks=0;
const ids=[1,2,3,4].map(n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const hashes=['a','b'].map(c=>'$2b$10$'+c.repeat(53)); // shape-only fixture, never a credential
const manifest=[{username:'student-a',password_hash:hashes[0]},{username:'student-b',password_hash:hashes[1]}];
const template=await fs.readFile('scripts/sql/reset-student-passwords.template.sql','utf8');
const sql=(records=manifest,count=2)=>template.replace('__REPLACEMENTS_JSON__',"'"+JSON.stringify(records).replaceAll("'","''")+"'::jsonb").replace('__EXPECTED_COUNT__',String(count));
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function scalar(q,p){return (await db.query(q,p)).rows[0]?.result;}
async function reject(q){await assert.rejects(db.exec(q));checks++;await db.exec('rollback');}
try{
 const tokens=['confirmation_token','recovery_token','email_change_token_current','email_change_token_new','phone_change_token','reauthentication_token'];
 const dates=['confirmation_sent_at','recovery_sent_at','email_change_sent_at','phone_change_sent_at','reauthentication_sent_at'];
 await db.exec(`create schema auth;create schema private;
 create table auth.users(id uuid primary key,email text,encrypted_password text,updated_at timestamptz default now(),deleted_at timestamptz,is_sso_user boolean default false,is_anonymous boolean default false,${tokens.map(c=>c+" text default 'pending'").join(',')},${dates.map(c=>c+' timestamptz default now()').join(',')});
 create table public.profiles(id uuid primary key,normalized_username text);
 create table private.admin_users(user_id uuid primary key);
 create table auth.sessions(id uuid primary key,user_id uuid);
 create table auth.refresh_tokens(id uuid primary key,user_id text,session_id uuid references auth.sessions(id) on delete cascade);
 create table auth.one_time_tokens(id uuid primary key,user_id uuid);
 create table auth.identities(id uuid primary key,user_id uuid);
 create table public.player_progress(user_id uuid primary key,best integer);
 create table public.level_progress(user_id uuid,level integer,stars integer);
 create table public.parent_monitoring_observations(id uuid primary key);
 create table public.jejak_aspect_runs(id uuid primary key);
 create function private.revoke_user_sessions(target uuid) returns void language sql as $$delete from auth.sessions where user_id=target$$;`);
 for(const [i,id] of ids.entries())await db.query('insert into auth.users(id,email,encrypted_password) values($1,$2,$3)',[id,'fixture-'+i+'@example.invalid','previous-marker-'+i]);
 for(const [i,name] of ['student-a','student-b','admin'].entries()){
  await db.query('insert into public.profiles values($1,$2)',[ids[i],name]);
  await db.query('insert into public.player_progress values($1,7)',[ids[i]]);
  await db.query('insert into public.level_progress values($1,1,3)',[ids[i]]);
  await db.query('insert into auth.sessions values($1,$1)',[ids[i]]);
  await db.query('insert into auth.refresh_tokens values($1,$2,$1)',[ids[i],ids[i]]);
  await db.query('insert into auth.one_time_tokens values($1,$1)',[ids[i]]);
 }
 await db.query('insert into private.admin_users values($1)',[ids[2]]);
 const before=await scalar('select md5(jsonb_agg(to_jsonb(u) order by id)::text) result from auth.users u');
 await reject(sql(manifest,3));
 await reject(sql([manifest[0],{username:'admin',password_hash:hashes[1]}]));
 await reject(sql([{username:'student-a',password_hash:'invalid'},manifest[1]]));
 eq(await scalar('select md5(jsonb_agg(to_jsonb(u) order by id)::text) result from auth.users u'),before);
 await db.exec(sql());
 eq((await db.query('select encrypted_password from auth.users where id=any($1::uuid[]) order by id',[ids.slice(0,2)])).rows.map(r=>r.encrypted_password),hashes);
 eq(await scalar('select encrypted_password result from auth.users where id=$1',[ids[2]]),'previous-marker-2');
 eq(await scalar('select encrypted_password result from auth.users where id=$1',[ids[3]]),'previous-marker-3');
 for(const table of ['sessions','refresh_tokens','one_time_tokens'])eq(await scalar(`select count(*)::int result from auth.${table}`),1);
 eq(await scalar('select sum(best)::int result from public.player_progress'),21);
 eq(await scalar('select count(*)::int result from auth.users where recovery_token=\'\' and reauthentication_token=\'\''),2);
 console.log(`PASS: ${checks} guarded student password reset checks`);
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}finally{await db.close();}
