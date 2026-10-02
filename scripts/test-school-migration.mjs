import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// An ephemeral PostgreSQL database, never a connection to the live project.
const db = await PGlite.create();
const school = 'SDN Kalibanteng Kulon 01';
const ids = [1, 2, 3, 4].map(index => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
let checks = 0;
function verify(actual, expected) { assert.deepEqual(actual, expected); checks++; }
async function value(sql, params) { return (await db.query(sql, params)).rows[0]?.result; }
async function login(id, role = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec(`set role ${role}`);
}
async function signup(id, username, schoolName) {
    await db.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [id, {
        display_name: username, username, normalized_username: username,
        ...(schoolName === undefined ? {} : { school_name: schoolName })
    }]);
}
try {
    await db.exec(`
        create role anon;
        create role authenticated;
        create role service_role bypassrls;
        create schema auth;
        create table auth.users(id uuid primary key, created_at timestamptz default now(), raw_user_meta_data jsonb);
        create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth, public to anon, authenticated, service_role;
        grant execute on function auth.uid() to anon, authenticated, service_role;
        alter default privileges in schema public grant all on tables to service_role;
    `);
    const migrations = (await fs.readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
    const target = migrations.find(name => name.endsWith('_school_registration_dashboard.sql'));
    assert.ok(target);
    for (const file of migrations.filter(file => file < target)) {
        await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
    }
    await signup(ids[0], 'admin');
    await signup(ids[1], 'siswa.satu');
    await signup(ids[2], 'siswa.dua');
    await db.query('insert into private.admin_users(user_id) values ($1)', [ids[0]]);
    await login(ids[1]);
    await db.query('select public.record_level_result(1::smallint, 3::smallint)');
    await db.exec('reset role');
    const before = await value('select jsonb_agg(to_jsonb(p) order by p.user_id) result from public.player_progress p');
    const beforeLevels = await value('select jsonb_agg(to_jsonb(p) order by p.user_id,p.level) result from public.level_progress p');
    await db.exec(await fs.readFile(`supabase/migrations/${target}`, 'utf8'));
    verify(await value('select count(*)::integer result from public.profiles where school_name = $1', [school]), 3);
    verify(await value('select jsonb_agg(to_jsonb(p) order by p.user_id) result from public.player_progress p'), before);
    verify(await value('select jsonb_agg(to_jsonb(p) order by p.user_id,p.level) result from public.level_progress p'), beforeLevels);
    await signup(ids[3], 'siswa.tiga', ' sdn  Sekolah Kedua ');
    verify(await value('select school_name result from public.profiles where id = $1', [ids[3]]), 'SDN SEKOLAH KEDUA');
    await assert.rejects(signup(crypto.randomUUID(), 'bad.school', ''), /Invalid school name/); checks++;
    await login(ids[0]);
    const all = await value('select public.admin_dashboard_summary() result');
    verify(all.totalUsers, 4);
    verify(all.schools, [school, 'SDN SEKOLAH KEDUA']);
    const firstSchool = await value('select public.admin_dashboard_summary($1) result', [school]);
    verify(firstSchool.totalUsers, 3);
    verify(firstSchool.inProgressUsers, 1);
    verify(firstSchool.schools, all.schools);
    const list = await value('select public.admin_list_users(null, \'all\', 2, 0, $1) result', [school]);
    verify(list.total, 3);
    verify(list.items.length, 2);
    verify(list.items.every(item => item.schoolName === school), true);
    const next = await value('select public.admin_list_users(null, \'all\', 2, 2, $1) result', [school]);
    verify(next.items.length, 1);
    verify(list.items.some(item => item.userId === next.items[0].userId), false);
    const searched = await value('select public.admin_list_users(\'siswa\', \'in_progress\', 25, 0, $1) result', [school]);
    verify(searched.total, 1);
    verify(searched.items[0].userId, ids[1]);
    verify((await value('select public.admin_list_users(null, \'all\', 25, 0, \'missing school\') result')).total, 0);
    verify((await value('select public.admin_list_users(null, \'all\', 25, 0) result')).total, 4);
    const marked = await value('select public.admin_list_users() result');
    verify(marked.items.find(item => item.userId === ids[0]).isAdmin, true);
    verify(marked.items.find(item => item.userId === ids[1]).isAdmin, false);
    await db.exec('reset role');
    await db.query('insert into private.admin_users(user_id) values ($1)', [ids[2]]);
    await login(ids[0]);
    verify((await value('select public.admin_list_users() result')).items.filter(item => item.isAdmin).length, 2);
    verify(await value("select has_function_privilege('anon', 'public.admin_dashboard_summary(text)', 'execute') result"), false);
    await login(ids[1]);
    verify(await value('select private.admin_profile_is_admin($1) result', [ids[0]]), false);
    await assert.rejects(db.query('select public.admin_dashboard_summary()'), /Admin access required/); checks++;
    verify(await value('select count(*)::integer result from public.profiles'), 1);
    await assert.rejects(db.query("update public.profiles set school_name = 'OTHER'"), /permission denied/); checks++;
    console.log(`PASS: ${checks} PostgreSQL checks (backfill, signup, score preservation, school filters, pagination, RLS and RPC privileges).`);
} finally { await db.close(); }
