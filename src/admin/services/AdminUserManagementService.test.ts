import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBackend } from './AdminSupabaseClient';
import { AdminUserManagementService } from './AdminUserManagementService';

const USER_ID = '123e4567-e89b-42d3-a456-426614174000';

function makeBackend() {
    return {
        signInWithPassword: vi.fn(),
        getSession: vi.fn(),
        signOut: vi.fn(),
        updateOwnPassword: vi.fn(),
        getJejakAspects: vi.fn(),
        rpc: vi.fn(),
        invokeAdminFunction: vi.fn().mockResolvedValue({
            data: { userId: USER_ID },
            error: null
        })
    } satisfies AdminBackend;
}

describe('AdminUserManagementService', () => {
    it('uses explicit staff operations with normalized input and no role/school mutation', async () => {
        const backend=makeBackend(); const service=new AdminUserManagementService(backend);
        await service.updateStaff(USER_ID,{displayName:' Guru Baru ',expectedUsername:'Guru.Lama',username:'Guru.Baru'});
        expect(backend.invokeAdminFunction).toHaveBeenLastCalledWith('staff_update',{userId:USER_ID,displayName:'Guru Baru',expectedUsername:'guru.lama',username:'guru.baru'});
        const password=crypto.randomUUID(); await service.resetStaffPassword(USER_ID,password);
        expect(backend.invokeAdminFunction).toHaveBeenLastCalledWith('staff_reset_password',{userId:USER_ID,password});
        await service.deleteStaff(USER_ID,'Guru.Baru');
        expect(backend.invokeAdminFunction).toHaveBeenLastCalledWith('staff_delete',{userId:USER_ID,expectedUsername:'guru.baru'});
        await expect(service.resetStaffPassword(USER_ID,'bad')).rejects.toMatchObject({code:'validation'});
        await expect(service.deleteStaff('bad','guru.baru')).rejects.toMatchObject({code:'validation'});
    });
    it('never returns malformed staff memberships or database denial details',async()=>{
        const backend=makeBackend(); const service=new AdminUserManagementService(backend);
        for(const data of [null,{},[null],[{userId:USER_ID,role:'teacher',schoolName:null}],[{userId:'bad',role:'forum',schoolName:null,username:'okay',displayName:'Okay'}]]) {
            backend.rpc.mockResolvedValue({data,error:null}); await expect(service.listStaff()).rejects.toThrow();
        }
        backend.rpc.mockResolvedValue({data:null,error:{code:'42501',message:'private.membership detail'}});
        await expect(service.listStaff()).rejects.toMatchObject({code:'access_denied',message:'Akun tidak memiliki akses admin'});
        await service.createStaff({role:'forum',displayName:'Forum Anak',username:'forum.anak',password:crypto.randomUUID()});
        expect(backend.invokeAdminFunction).toHaveBeenLastCalledWith('create_staff',expect.not.objectContaining({schoolName:expect.anything()}));
        backend.rpc.mockRejectedValue(new Error('internal network detail'));
        await expect(service.listStaff()).rejects.toMatchObject({code:'generic'});
        vi.stubGlobal('navigator',{onLine:false});
        await expect(service.listStaff()).rejects.toMatchObject({code:'offline'});
    });
    it('creates scoped staff and validates role and school before sending', async () => {
        const backend = makeBackend();
        const service = new AdminUserManagementService(backend);
        const input = { role: 'teacher' as const, schoolName: '  sdn satu  ', displayName: 'Guru Satu', username: 'guru.satu', password: crypto.randomUUID() };
        await service.createStaff(input);
        expect(backend.invokeAdminFunction).toHaveBeenLastCalledWith('create_staff', { ...input, schoolName: 'SDN SATU' });
        await expect(service.createStaff({ ...input, role: 'master' as never })).rejects.toThrow();
        await expect(service.createStaff({ ...input, schoolName: '' })).rejects.toThrow();
        backend.rpc.mockResolvedValue({ data: [{ userId: USER_ID, role: 'school', schoolName: 'SDN SATU', displayName: 'Admin Satu', username: 'admin.satu' }], error: null });
        expect(await service.listStaff()).toHaveLength(1);
        expect(backend.rpc).toHaveBeenCalledWith('admin_list_staff');
    });
    beforeEach(() => {
        vi.stubGlobal('navigator', { onLine: true });
    });

    it('normalizes and creates a player through the trusted function port', async () => {
        const backend = makeBackend();
        const credential = crypto.randomUUID();
        const service = new AdminUserManagementService(backend);

        await expect(service.createUser({
            displayName: '  Sinta Dewi  ',
            username: '  SINTA.01  ',
            password: credential
        })).resolves.toMatchObject({ userId: USER_ID });
        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('create', {
            displayName: 'Sinta Dewi',
            username: 'sinta.01',
            password: credential
        });
    });

    it.each([
        [{ displayName: 'S', username: 'sinta', password: crypto.randomUUID() }],
        [{ displayName: 'Sinta', username: '<admin>', password: crypto.randomUUID() }],
        [{ displayName: 'Sinta', username: 'sinta', password: 'x'.repeat(5) }]
    ])('rejects invalid create input before the trusted call: %#', async (input) => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend).createUser(input))
            .rejects.toMatchObject({ code: 'validation' });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('normalizes and sends an edited username with the display name', async () => {
        const backend = makeBackend();

        await new AdminUserManagementService(backend).updateUser(USER_ID, {
            displayName: '  Sinta Baru ',
            expectedUsername: '  SINTA.LAMA  ',
            username: '  SINTA.BARU  '
        });

        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('update', {
            userId: USER_ID,
            displayName: 'Sinta Baru',
            expectedUsername: 'sinta.lama',
            username: 'sinta.baru'
        });
    });

    it.each([
        ['not-a-uuid', {
            displayName: 'Sinta', expectedUsername: 'sinta', username: 'sinta.baru'
        }],
        [USER_ID, {}],
        [USER_ID, {
            displayName: 'x', expectedUsername: 'sinta', username: 'sinta.baru'
        }],
        [USER_ID, {
            displayName: 'Sinta', expectedUsername: '<admin>', username: 'sinta.baru'
        }],
        [USER_ID, {
            displayName: 'Sinta', expectedUsername: 'sinta', username: '<admin>'
        }]
    ])('rejects an unsafe update before the trusted call', async (userId, changes) => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend).updateUser(userId, changes))
            .rejects.toMatchObject({ code: 'validation' });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('deletes by validated user id through the trusted function port', async () => {
        const backend = makeBackend();

        await new AdminUserManagementService(backend).deleteUser(USER_ID, 'budi');

        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('delete', {
            userId: USER_ID,
            expectedUsername: 'budi'
        });
    });

    it('rejects delete unless both user id and expected username are valid', async () => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend).deleteUser(USER_ID, '<admin>'))
            .rejects.toMatchObject({ code: 'validation' });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('resets a credential through the trusted function port without returning it', async () => {
        const backend = makeBackend();
        const credential = crypto.randomUUID();

        const result = await new AdminUserManagementService(backend)
            .resetPassword(USER_ID, credential);

        expect(result).not.toHaveProperty('password');
        expect(backend.invokeAdminFunction).toHaveBeenCalledWith('reset_password', {
            userId: USER_ID,
            password: credential
        });
    });

    it.each([
        ['not-a-uuid', crypto.randomUUID()],
        [USER_ID, 'x'.repeat(5)]
    ])('rejects an invalid reset before the trusted call', async (userId, credential) => {
        const backend = makeBackend();

        await expect(new AdminUserManagementService(backend)
            .resetPassword(userId, credential)).rejects.toMatchObject({
            code: 'validation'
        });
        expect(backend.invokeAdminFunction).not.toHaveBeenCalled();
    });

    it('maps trusted-function failures to safe admin errors', async () => {
        const backend = makeBackend();
        backend.invokeAdminFunction.mockResolvedValue({
            data: null,
            error: { status: 403, code: '42501', message: 'internal authorization detail' }
        });

        await expect(new AdminUserManagementService(backend).deleteUser(USER_ID, 'budi'))
            .rejects.toMatchObject({
                code: 'access_denied',
                message: 'Akun tidak memiliki akses admin'
            });
    });
});
