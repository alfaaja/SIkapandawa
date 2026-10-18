import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = await PGlite.create(); let checks=0;
const ids = Array.from({length:12},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const value = async (sql,args) => (await db.query(sql,args)).rows[0]?.result;
const same = (a,b) => { assert.deepEqual(a,b); checks++; };
async function denied(promise) { await assert.rejects(promise); checks++; }
async function login(index,role='authenticated') {
 await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[index===null?'':ids[index]]);
 await db.exec(`set role ${role}`);
}
function profile(index,school='SEKOLAH A') { const username=index===0?'Sikapandawa':`fixture${index}`;
 return {username,normalized_username:username.toLowerCase(),display_name:`Fixture ${index}`,school_name:school}; }
const correct=['yudhistira-01','yudhistira-02','bima-01','bima-02','arjuna-01','arjuna-02','nakula-01','nakula-02','sadewa-04','sadewa-05']
 .map((cardId,i)=>({cardId,basket:['good','bad','bad','good','bad','good','good','bad','bad','good'][i]}));
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb,raw_app_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;`);
 for(const file of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
  if(process.env.STAFF_BASELINE==='1' && file.endsWith('_school_teacher_provisioning.sql')) continue;
  if(file==='20261017084335_staff_school_access.sql') {
   await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[ids[0],profile(0)]);
   await db.query('insert into private.admin_users(user_id) values($1)',[ids[0]]);
  }
  await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 }
 same(await value('select role result from private.admin_users where user_id=$1',[ids[0]]),'master');
 for(let i=1;i<=6;i++) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[ids[i],profile(i,[2,6].includes(i)?'SEKOLAH B':'SEKOLAH A')]);
 for(const [i,role,school] of [[1,'school','SEKOLAH A'],[2,'school','SEKOLAH B'],[3,'forum',null],[4,'teacher','SEKOLAH A']])
  await db.query('insert into private.admin_users(user_id,role,school_name) values($1,$2,$3)',[ids[i],role,school]);
 await denied(db.query("insert into private.admin_users(user_id,role,school_name) values($1,'school','SEKOLAH A')",[ids[5]]));
 for(const i of [5,6]) {
  await login(i);
  for(let level=1;level<=10;level++) await db.query('select public.record_level_result($1::smallint,1::smallint)',[level]);
  await db.exec('select public.unlock_jejak_pandawa()');
  await db.query('select public.record_jejak_aspect_result_v2($1,$2)',[crypto.randomUUID(),correct]);
 }
 for(const [i,expected] of [[0,[ids[5],ids[6]]],[1,[ids[5]]],[2,[ids[6]]],[3,[ids[5],ids[6]]],[4,[ids[5]]],[5,[ids[5]]]]) {
  await login(i);
  same((await db.query('select id from public.profiles order by id')).rows.map(x=>x.id),expected);
  same(await value('select count(*)::int result from public.player_progress'),expected.length);
  same(await value('select count(*)::int result from public.level_progress'),expected.length*10);
  same(await value('select count(*)::int result from public.jejak_aspect_runs'),i===4?0:expected.length);
  if(i<4) {
   same((await value('select public.admin_dashboard_summary() result')).totalUsers,expected.length);
   same((await value('select public.admin_list_users() result')).total,expected.length);
   same((await value('select public.admin_school_aspect_averages_v2() result')).length,expected.length);
  } else await denied(db.query('select public.admin_dashboard_summary()'));
 }
 await login(1);
 same((await value("select public.admin_dashboard_summary('SEKOLAH B') result")).totalUsers,0);
 await denied(db.query('select public.admin_get_user_progress($1)',[ids[6]]));
 same((await value('select public.admin_list_staff() result')).map(item=>item.userId),[ids[4]]);
 await denied(db.query("select public.admin_assign_staff($1,$2,'forum')",[ids[1],ids[5]]));
 await login(0); same((await value('select public.admin_list_staff() result')).length,5);
 await login(null,'service_role');
 same(await value("select public.admin_authorize_account_action($1,'create',null,null) result",[ids[1]]),{role:'school',schoolName:'SEKOLAH A'});
 await denied(db.query("select public.admin_authorize_account_action($1,'create',null,'SEKOLAH B')",[ids[1]]));
 for(const action of ['update','rename_username','delete','reset_password']) {
  await denied(db.query('select public.admin_authorize_account_action($1,$2,$3,null)',[ids[1],action,ids[6]]));
  await denied(db.query('select public.admin_authorize_account_action($1,$2,$3,null)',[ids[3],action,ids[1]]));
 }
 same((await value("select public.admin_authorize_account_action($1,'create_staff') result",[ids[1]])).schoolName,'SEKOLAH A');
 await denied(db.query("select public.admin_authorize_account_action($1,'create_staff',null,'SEKOLAH B')",[ids[1]]));
 await denied(db.query("select public.admin_authorize_account_action($1,'create')",[ids[4]]));
 same((await value("select public.admin_authorize_account_action($1,'delete',$2) result",[ids[3],ids[6]])).role,'forum');
 // Trusted Auth metadata claims are checked and assigned in the signup transaction.
 const op=crypto.randomUUID(); const details={role:'school',schoolName:'SEKOLAH C'};
 await db.query("select public.admin_begin_account_operation($1,$2,'create_staff',null,'fixture7',$3,$4)",[op,ids[0],'fingerprint-fixture-1',details]);
 await db.exec('reset role');
 const meta={admin_operation_id:op,staff_role:'school',staff_actor_id:ids[0],staff_school_name:'SEKOLAH C'};
 await db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[7],profile(7,'SEKOLAH C'),meta]);
 same(await value('select role result from private.admin_users where user_id=$1',[ids[7]]),'school');
 await login(null,'service_role');
 await denied(db.query("select public.admin_authorize_account_action($1,'reset_password',$2)",[ids[3],ids[7]]));
 await db.query("select public.admin_assign_staff($1,$2,'school','SEKOLAH C')",[ids[0],ids[7]]);
 await db.exec('reset role');
 // Signup user_metadata cannot grant roles; forged/duplicate trusted claims roll back Auth+profile.
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[ids[8],{...profile(8),role:'master',staff_role:'master'}]);
 same(await value('select count(*)::int result from private.admin_users where user_id=$1',[ids[8]]),0);
 await denied(db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[9],profile(9,'SEKOLAH C'),meta]));
 same(await value('select count(*)::int result from auth.users where id=$1',[ids[9]]),0);
 await login(null,'service_role');
 const op2=crypto.randomUUID();
 await db.query("select public.admin_begin_account_operation($1,$2,'create_staff',null,'fixture9',$3,$4)",[op2,ids[0],'fingerprint-fixture-2',details]);
 await db.exec('reset role');
 await denied(db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[9],profile(9,'SEKOLAH C'),{...meta,admin_operation_id:op2}]));
 same(await value('select count(*)::int result from public.profiles where id=$1',[ids[9]]),0);
 // Older Edge versions omit schoolName in their ledger: signup still checks actual school.
 await login(null,'service_role');
 const legacyOp=crypto.randomUUID();
 await db.query("select public.admin_begin_account_operation($1,$2,'create',null,'fixture10',$3,'{}')",[legacyOp,ids[1],'fingerprint-legacy-1']);
 await db.exec('reset role');
 await denied(db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[10],profile(10,'SEKOLAH B'),{admin_operation_id:legacyOp}]));
 same(await value('select count(*)::int result from auth.users where id=$1',[ids[10]]),0);
 await db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[10],profile(10,'SEKOLAH A'),{admin_operation_id:legacyOp}]);
 same(await value('select count(*)::int result from public.profiles where id=$1',[ids[10]]),1);
 // New school-admin provisioning must pass audit, atomic signup and assignment checks.
 await login(null,'service_role');
 for(const details of [{role:'forum',schoolName:null},{role:'school',schoolName:'SEKOLAH A'},{role:'teacher',schoolName:'SEKOLAH B'}]) {
  await denied(db.query("select public.admin_begin_account_operation($1,$2,'create_staff',null,'fixture11',$3,$4)",[crypto.randomUUID(),ids[1],crypto.randomUUID(),details]));
 }
 await denied(db.query("select public.admin_assign_staff($1,$2,'forum')",[ids[1],ids[8]]));
 await denied(db.query("select public.admin_assign_staff($1,$2,'teacher','SEKOLAH B')",[ids[1],ids[8]]));
 const teacherOp=crypto.randomUUID();
 await db.query("select public.admin_begin_account_operation($1,$2,'create_staff',null,'fixture11',$3,$4)",[teacherOp,ids[1],'teacher-operation',{role:'teacher',schoolName:'SEKOLAH A'}]);
 await db.exec('reset role');
 const teacherMeta={admin_operation_id:teacherOp,staff_role:'teacher',staff_actor_id:ids[1],staff_school_name:'SEKOLAH A'};
 await denied(db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[11],profile(11,'SEKOLAH B'),{...teacherMeta,staff_school_name:'SEKOLAH B'}]));
 same(await value('select count(*)::int result from auth.users where id=$1',[ids[11]]),0);
 await db.query('insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3)',[ids[11],profile(11),teacherMeta]);
 same(await value('select role result from private.admin_users where user_id=$1',[ids[11]]),'teacher');
 await login(null,'service_role'); await db.query("select public.admin_assign_staff($1,$2,'teacher','SEKOLAH A')",[ids[1],ids[11]]);
 await login(1); same((await value('select public.admin_list_staff() result')).length,2);
 await login(2); same((await value('select public.admin_list_staff() result')).length,0);
 await login(11); same((await value('select public.teacher_monitoring_context() result')).students.every(student=>student.schoolName==='SEKOLAH A'),true);
 await denied(db.query('select public.admin_list_staff()'));
 for(const role of ['authenticated','anon']) {
  await login(5,role);
  await denied(db.query("select public.admin_authorize_account_action($1,'delete',$2)",[ids[0],ids[6]]));
  await denied(db.query("select public.admin_assign_staff($1,$2,'master')",[ids[0],ids[5]]));
  await denied(db.query('select * from private.admin_users'));
 }
 // Explicit master-only staff lifecycle; legacy player endpoints remain protected.
 await login(null,'service_role');
 for (const action of ['staff_update','staff_rename_username','staff_reset_password','staff_delete']) {
  for(const target of [1,3,4]) same((await value('select public.admin_authorize_account_action($1,$2,$3) result',[ids[0],action,ids[target]])).role,'master');
  same((await value('select public.admin_authorize_account_action($1,$2,$3) result',[ids[1],action,ids[4]])).role,'school');
  for(const actor of [2,3,4,5]) await denied(db.query('select public.admin_authorize_account_action($1,$2,$3)',[ids[actor],action,ids[4]]));
  for(const target of [0,1,2,3,5,6,7]) await denied(db.query('select public.admin_authorize_account_action($1,$2,$3)',[ids[1],action,ids[target]]));
  await denied(db.query('select public.admin_authorize_account_action($1,$2,$3)',[ids[0],action,ids[5]]));
  if(action==='staff_delete') await denied(db.query('select public.admin_authorize_account_action($1,$2,$3)',[ids[0],action,ids[0]]));
  else same((await value('select public.admin_authorize_account_action($1,$2,$3) result',[ids[0],action,ids[0]])).role,'master');
 }
 await denied(db.query("select public.admin_authorize_account_action($1,'update',$2)",[ids[0],ids[4]]));
 const staffOp=crypto.randomUUID();
 await db.query("select public.admin_begin_account_operation($1,$2,'staff_rename_username',$3,'guru.renamed',$4,$5)",[staffOp,ids[0],ids[4],crypto.randomUUID(),{managedStaff:true,changedFields:['username']}]);
 const competingOp=crypto.randomUUID();
 await denied(db.query("select public.admin_begin_account_operation($1,$2,'staff_rename_username',$3,'guru.school',$4,'{}')",[crypto.randomUUID(),ids[1],ids[4],crypto.randomUUID()]));
 await denied(db.query("select public.admin_begin_account_operation($1,$2,'staff_rename_username',$3,'guru.other',$4,'{}')",[competingOp,ids[0],ids[4],crypto.randomUUID()]));
 await denied(db.query("select public.admin_begin_account_operation($1,$2,'staff_delete',$3,'fixture4',$4,'{}')",[crypto.randomUUID(),ids[0],ids[4],crypto.randomUUID()]));
 await db.query("select public.admin_service_update_staff_identity($1,$2,'fixture4','Guru Baru','guru.renamed')",[ids[0],ids[4]]);
 same(await value('select username result from public.profiles where id=$1',[ids[4]]),'guru.renamed');
 same(await value('select role result from private.admin_users where user_id=$1',[ids[4]]),'teacher');
 await db.query("select public.admin_finish_account_operation($1,'succeeded',null,$2)",[staffOp,ids[4]]);
 await db.query("select public.admin_begin_account_operation($1,$2,'staff_rename_username',$3,'guru.other',$4,'{}')",[competingOp,ids[0],ids[4],crypto.randomUUID()]);
 await db.query("select public.admin_finish_account_operation($1,'failed','mutation_failed',$2)",[competingOp,ids[4]]);
 const schoolEdit=crypto.randomUUID();
 await db.query("select public.admin_begin_account_operation($1,$2,'staff_rename_username',$3,'guru.lagi',$4,'{}')",[schoolEdit,ids[1],ids[4],crypto.randomUUID()]);
 await db.query("select public.admin_service_update_staff_identity($1,$2,'guru.renamed','Guru Lagi','guru.lagi')",[ids[1],ids[4]]);
 same(await value('select username result from public.profiles where id=$1',[ids[4]]),'guru.lagi');
 await db.query("select public.admin_finish_account_operation($1,'succeeded',null,$2)",[schoolEdit,ids[4]]);
 await denied(db.query("select public.admin_service_update_staff_identity($1,$2,'fixture4','Guru Lagi','guru.lagi')",[ids[0],ids[4]]));
 await db.query("select public.admin_service_update_staff_identity($1,$2,'fixture1','Kepala Baru','kepala.baru')",[ids[0],ids[1]]);
 same(await value('select school_name result from private.admin_users where user_id=$1',[ids[1]]),'SEKOLAH A');
 await db.query("select public.admin_service_update_staff_identity($1,$1,'sikapandawa','Master Baru','master.baru')",[ids[0]]);
 same(await value('select role result from private.admin_users where user_id=$1',[ids[0]]),'master');
 await denied(db.query("select public.admin_authorize_account_action($1,'staff_delete',$1)",[ids[0]]));
 await login(4);
 const observationId=crypto.randomUUID(); const scores={kejujuran:3,keberanian:2,kesopanan:4,kebijaksanaan:3,keadilan:2};
 await db.query("select public.submit_teacher_monitoring($1,$2,1,now(),'Guru Awal','','Pengamatan kelas','','',$3,'periode 1')",[ids[5],observationId,scores]);
 await db.exec('reset role');
 const beforeStudents=await value("select md5(string_agg(row_to_json(p)::text,',' order by id)) result from public.profiles p where id in ($1,$2)",[ids[5],ids[6]]);
 await db.query('delete from auth.users where id=$1',[ids[4]]);
 same(await value('select submitted_by is null result from public.parent_monitoring_observations where id=$1',[observationId]),true);
 same(await value('select scores result from public.parent_monitoring_observations where id=$1',[observationId]),scores);
 same(await value("select md5(string_agg(row_to_json(p)::text,',' order by id)) result from public.profiles p where id in ($1,$2)",[ids[5],ids[6]]),beforeStudents);
 same(await value('select count(*)::int result from public.level_progress where user_id in ($1,$2)',[ids[5],ids[6]]),20);
 for(const role of ['anon','authenticated']) { await login(0,role); await denied(db.query("select public.admin_service_update_staff_identity($1,$2,'fixture3','Forum Lagi','forum.lagi')",[ids[0],ids[3]])); }
 console.log(`PASS: ${checks} staff scope and atomic provisioning PostgreSQL checks`);
} catch(error) { console.error('FAIL:',error.message); if(error.where) console.error(error.where); process.exitCode=1; }
finally { await db.close(); }
