import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = await PGlite.create(); let checks = 0;
const ids = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const scores = value => ({ kejujuran: value, keberanian: null, kesopanan: value, kebijaksanaan: value, keadilan: value });
const value = async (sql, args) => (await db.query(sql, args)).rows[0]?.result;
const verify = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
async function reject(promise, pattern) { await assert.rejects(promise, pattern); checks++; }
async function login(i, role = 'authenticated') {
    await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [i === null ? '' : ids[i]]); await db.exec(`set role ${role}`);
}
const submitParent = (id, score = 4, date = '2026-10-17T12:00:00Z', point = 1, period = 'Periode 1') => value('select public.submit_parent_monitoring_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result', [id, point, date, 'Orang Tua', '', 'Mengamati perilaku', '', '', scores(score), period]);
const submitTeacher = (target, id, score = 2, date = '2026-10-17T13:00:00Z', point = 1, period = 'Periode 1') => value('select public.submit_teacher_monitoring($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) result', [ids[target], id, point, date, 'Guru Sekolah', '', 'Mengamati perilaku', '', '', scores(score), period]);
try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create table auth.users(id uuid primary key,created_at timestamptz default now(),raw_user_meta_data jsonb);
        create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid);
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema auth,public to anon,authenticated,service_role;
        grant execute on function auth.uid() to anon,authenticated,service_role;
        alter default privileges in schema public grant all on tables to service_role;`);
    for (const file of (await fs.readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) await db.exec(await fs.readFile('supabase/migrations/' + file, 'utf8'));
    for (const [i, id] of ids.entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username: i === 0 ? 'Sikapandawa' : 'siswa' + i, normalized_username: i === 0 ? 'sikapandawa' : 'siswa' + i, display_name: 'Akun ' + i, school_name: i === 6 ? 'Sekolah B' : 'Sekolah A' }]);
    for (const [i, role, school] of [[0, 'master', null], [1, 'school', 'SEKOLAH A'], [2, 'forum', null], [3, 'teacher', 'SEKOLAH A']]) await db.query('insert into private.admin_users(user_id,role,school_name) values($1,$2,$3)', [ids[i], role, school]);
    await login(4); const first = crypto.randomUUID(); await submitParent(first); await submitParent(first);
    verify((await value('select public.monitoring_history() result')).total, 1);
    await submitParent(crypto.randomUUID(), 2); // Repeat preserved; parent average now 3.
    await submitParent(crypto.randomUUID(), 4, '2026-10-18T12:00:00Z', 2); // Other date: not paired.
    await reject(submitTeacher(4, crypto.randomUUID()), /Teacher school access required/);
    await reject(db.query("insert into public.parent_monitoring_observations(id,user_id,point_number,observed_at,guardian_name,situation,scores,reporter_type,submitted_by) values(gen_random_uuid(),$1,1,now(),'Fake Guru','test',$2,'teacher',$1)", [ids[4], scores(4)]));
    await login(3); verify((await value('select public.teacher_monitoring_context() result')).students.map(s => s.userId).sort(), [ids[4], ids[5]].sort());
    const teacherId = crypto.randomUUID(); await submitTeacher(4, teacherId); await submitTeacher(4, teacherId);
    await reject(submitTeacher(4, teacherId, 1), /already used/);
    await reject(submitTeacher(6, crypto.randomUUID()), /Teacher school access required/);
    await reject(submitParent(crypto.randomUUID()), /student account/);
    await reject(db.query('select public.parent_monitoring_context()'));
    await reject(db.query('select public.admin_monitoring_summary_v2(\'teacher\')'));
    await reject(db.query('update public.parent_monitoring_observations set situation=\'changed\''));
    await reject(db.query('delete from public.parent_monitoring_observations'));
    verify((await value("select public.monitoring_history_v2('teacher',$1) result", [ids[4]])).total, 1);
    await reject(db.query("select public.monitoring_history_v2('teacher',$1)", [ids[6]]));
    await submitTeacher(4, crypto.randomUUID(), 4, '2026-10-19T12:00:00Z', 2);
    // Jakarta day must be used consistently: 18:00UTC on 16th is 17th WIB.
    await submitTeacher(4, crypto.randomUUID(), 2, '2026-10-16T18:00:00Z', 3);
    await login(4); await submitParent(crypto.randomUUID(), 4, '2026-10-17T01:00:00Z', 3);
    verify((await value('select public.monitoring_history() result')).total, 4);
    verify(await value('select count(*)::int result from public.parent_monitoring_observations where reporter_type=\'teacher\''), 0);
    await reject(db.query("select public.monitoring_history_v2('teacher')"));
    await login(1);
    const parentSummary = await value("select public.admin_monitoring_summary_v2('parent') result");
    const teacherSummary = await value("select public.admin_monitoring_summary_v2('teacher') result");
    verify(parentSummary.map(s => s.schoolName), ['SEKOLAH A']); verify(teacherSummary[0].participantCount, 1);
    verify(parentSummary[0].points[0].aspects[0].average, 3); verify(teacherSummary[0].points[0].aspects[0].average, 2);
    const comparison = await value('select public.admin_monitoring_comparison($1) result', [ids[4]]);
    verify(comparison.ruleVersion, 'draft-1'); verify(comparison.cells.length, 12);
    verify(comparison.cells.filter(c => c.pointNumber === 2).length, 4);
    verify(comparison.cells.find(c => c.pointNumber === 1 && c.aspect === 'kejujuran'), { pointNumber: 1, period: 'periode 1', aspect: 'kejujuran', parentAverage: 3, teacherAverage: 2, parentCount: 2, teacherCount: 1 });
    verify(comparison.cells.find(c => c.pointNumber === 3).period, 'periode 1');
    await login(4); await submitParent(crypto.randomUUID(),1,'2026-10-20T12:00:00Z',1,'Periode 2');
    await login(3); await submitTeacher(4,crypto.randomUUID(),4,'2026-10-23T12:00:00Z',1,'Periode 2');
    await login(1);
    verify((await value('select public.admin_monitoring_comparison($1) result',[ids[4]])).cells.length,12);
    const secondPeriod=await value("select public.admin_monitoring_comparison($1,'Periode 2') result",[ids[4]]);
    verify(secondPeriod.cells[0].parentAverage,1); verify(secondPeriod.cells[0].teacherAverage,4);
    verify((await value("select public.admin_monitoring_comparison($1,'legacy') result",[ids[4]])).cells,[]);
    await reject(db.query('select public.admin_monitoring_comparison($1)', [ids[6]]));
    await reject(db.query("select public.admin_monitoring_summary_v2('teacher',null,$1)", [ids[6]]));
    await reject(db.query("select public.admin_monitoring_summary_v2('unknown')"));
    await login(2); verify((await value("select public.admin_monitoring_summary_v2('teacher') result")).length, 2);
    verify((await value('select public.admin_monitoring_comparison($1) result', [ids[6]])).cells, []);
    await login(0); verify((await value("select public.admin_monitoring_summary_v2('parent') result")).length, 2);
    await login(null, 'anon');
    for (const query of ['select public.teacher_monitoring_context()', "select public.monitoring_history_v2('parent')", "select public.admin_monitoring_summary_v2('teacher')", `select public.admin_monitoring_comparison('${ids[4]}')`]) await reject(db.query(query));
    console.log('PASS: ' + checks + ' teacher monitoring and comparison PostgreSQL checks');
} catch (error) { console.error(error.message); if (error.where) console.error(error.where); process.exitCode = 1; }
finally { await db.close(); }
