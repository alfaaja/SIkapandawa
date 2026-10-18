// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createAdminMockBackend } from './AdminMockBackend';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function setup(role = 'master') {
    history.replaceState(null,'',`/admin/?mockAdmin=1&mockSchools=2&mockRole=${role}`);
    return createAdminMockBackend();
}
const input = () => ({ displayName:'Pengelola Satu', username:'pengelola.satu', password:crypto.randomUUID(), role:'school', schoolName:'SDN SATU' });
describe('local role demo contracts', () => {
    it('allows school managers to CRUD own teachers while preserving student cohorts', async () => {
        const backend=setup('school');
        const created=await backend.invokeAdminFunction('create_staff',{...input(),role:'teacher',schoolName:'SDN Kalibanteng Kulon 01',username:'guru.sekolah'});
        const userId=(created.data as {userId:string}).userId;
        expect((await backend.invokeAdminFunction('staff_update',{userId,displayName:'Guru Baru',expectedUsername:'guru.sekolah',username:'guru.baru'})).error).toBeNull();
        expect((await backend.invokeAdminFunction('staff_reset_password',{userId,password:crypto.randomUUID()})).error).toBeNull();
        expect((await backend.invokeAdminFunction('staff_delete',{userId,expectedUsername:'guru.baru'})).error).toBeNull();
        expect((await backend.rpc('admin_list_staff')).data).toEqual([]);
        expect((await backend.rpc('admin_dashboard_summary')).data).toMatchObject({totalUsers:40});
        for(const action of ['staff_update','staff_reset_password','staff_delete']) expect((await backend.invokeAdminFunction(action,{userId:id(999)})).error?.code).toBe('42501');
    });
    it('lets only master manage school/forum/teacher and protects deletion of master', async () => {
        const backend=setup();
        for(const role of ['school','teacher','forum']) {
            const created=await backend.invokeAdminFunction('create_staff',{...input(),role,username:`${role}.satu`});
            const userId=(created.data as {userId:string}).userId;
            expect((await backend.invokeAdminFunction('staff_update',{userId,displayName:'Nama Baru',expectedUsername:`${role}.satu`,username:`${role}.baru`})).error).toBeNull();
            expect((await backend.invokeAdminFunction('staff_reset_password',{userId,password:crypto.randomUUID()})).error).toBeNull();
            expect((await backend.invokeAdminFunction('staff_delete',{userId,expectedUsername:'salah'})).error).not.toBeNull();
            expect((await backend.invokeAdminFunction('staff_delete',{userId,expectedUsername:`${role}.baru`})).error).toBeNull();
        }
        expect((await backend.rpc('admin_list_staff')).data).toHaveLength(1);
        expect((await backend.rpc('admin_dashboard_summary')).data).toMatchObject({totalUsers:56});
        expect((await backend.invokeAdminFunction('staff_update',{userId:id(999),displayName:'Master Baru',expectedUsername:'admin.demo',username:'master.baru'})).error).toBeNull();
        expect((await backend.invokeAdminFunction('staff_reset_password',{userId:id(999),password:crypto.randomUUID()})).error).toBeNull();
        expect((await backend.invokeAdminFunction('staff_delete',{userId:id(999),expectedUsername:'master.baru'})).error?.code).toBe('42501');
        for(const role of ['school','forum']) for(const action of ['staff_update','staff_delete','staff_reset_password']) {
            expect((await setup(role).invokeAdminFunction(action,{userId:id(999)})).error?.code).toBe('42501');
        }
    });
    beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
    it('keeps staff out of student cohorts and enforces the one-school-admin demo contract', async () => {
        const backend=setup();
        expect((await backend.getSession()).data).toMatchObject({session:null});
        await backend.signInWithPassword({email:'fixture@example.invalid',password:crypto.randomUUID()});
        expect((await backend.getSession()).data).toMatchObject({session:{user:{id:id(999)}}});
        expect((await backend.rpc('staff_access')).data).toEqual({role:'master',schoolName:null});
        expect((await backend.rpc('admin_list_staff')).data).toHaveLength(1);
        expect((await backend.invokeAdminFunction('create_staff',input())).error).toBeNull();
        expect((await backend.invokeAdminFunction('create_staff',{...input(),username:'other.admin'})).error?.code).toBe('23505');
        expect((await backend.invokeAdminFunction('create_staff',{...input(),role:'teacher',username:'guru.satu'})).error).toBeNull();
        expect((await backend.invokeAdminFunction('create_staff',{...input(),role:'forum',username:'forum.satu'})).error).toBeNull();
        expect((await backend.rpc('admin_list_staff')).data).toHaveLength(4);
        expect((await backend.rpc('admin_dashboard_summary')).data).toMatchObject({totalUsers:56});
        for(const invalid of [{...input(),role:'master'},{...input(),username:'a'},{...input(),displayName:''},{...input(),password:''},{...input(),schoolName:''}]) {
            expect((await backend.invokeAdminFunction('create_staff',invalid)).error?.code).toBe('22023');
        }
        await backend.signOut(); expect((await backend.getSession()).data).toMatchObject({session:null});
    });
    it.each(['school','forum'])('models %s access without granting staff management',async role => {
        const backend=setup(role);
        if (role === 'school') {
            expect((await backend.rpc('admin_list_staff')).data).toEqual([]);
            expect((await backend.invokeAdminFunction('create_staff', { ...input(), role:'teacher', schoolName:'SDN Kalibanteng Kulon 01' })).error).toBeNull();
            expect((await backend.rpc('admin_list_staff')).data).toHaveLength(1);
            expect((await backend.invokeAdminFunction('create_staff', { ...input(), role:'teacher', schoolName:'SDN LAIN' })).error?.code).toBe('42501');
        } else expect((await backend.rpc('admin_list_staff')).error?.code).toBe('42501');
        expect((await backend.invokeAdminFunction('create_staff',input())).error?.code).toBe('42501');
        const list=await backend.rpc('admin_list_users',{page_size:100});
        const items=(list.data as {items:Array<{schoolName:string}>}).items;
        expect(new Set(items.map(x=>x.schoolName)).size).toBe(role==='school'?1:2);
        const before=await backend.getJejakAspects(id(1)); expect(before.error).toBeNull();
        expect((await backend.getJejakAspects(id(11))).data).toMatchObject({kejujuran:2,keberanian:0});
        if(role==='school') {
            expect((await backend.getJejakAspects(id(41))).error?.code).toBe('42501');
            for(const action of ['delete','update','reset_password']) expect((await backend.invokeAdminFunction(action,{userId:id(41)})).error).not.toBeNull();
            expect((await backend.invokeAdminFunction('create',{...input(),schoolName:'SDN LAIN'})).error?.code).toBe('42501');
        }
        expect((await backend.rpc('admin_monitoring_summary_v2',{reporter_type:'teacher',monitoring_period:'periode 2'})).error).toBeNull();
        expect((await backend.rpc('admin_monitoring_comparison',{target_user_id:id(1),monitoring_period:'periode 2'})).data).toMatchObject({cells:[]});
        expect((await backend.rpc('monitoring_history_v2',{target_user_id:id(1),reporter_type:'parent',monitoring_period:'periode 2'})).data).toMatchObject({total:0});
    });
    it.each(['teacher','user','invalid'])('fails closed for %s on every privileged demo entry', async role => {
        const backend=setup(role);
        expect((await backend.rpc('admin_dashboard_summary')).error?.code).toBe('42501');
        expect((await backend.invokeAdminFunction('create_staff',input())).error?.code).toBe('42501');
        expect((await backend.getJejakAspects(id(1))).error?.code).toBe('42501');
    });
});
