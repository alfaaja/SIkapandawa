// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccessDialog, type AdminAccessItem } from './AdminAccessDialog';

const existing: AdminAccessItem = { userId: 'school-id', displayName: 'Kepala sekolah', username: 'kepala.sekolah', role: 'school', schoolName: 'SDN Kalibanteng Kulon 01' };

function setup(accounts: AdminAccessItem[] = [], teacherSchool: string | null = null) {
    const parent = document.createElement('div'); document.body.append(parent);
    const callbacks = { onCreate: vi.fn().mockResolvedValue({}), onList: vi.fn().mockResolvedValue(accounts), onUpdate: vi.fn().mockResolvedValue({}), onResetPassword: vi.fn().mockResolvedValue({}), onDelete: vi.fn().mockResolvedValue({}) };
    const dialog = new AdminAccessDialog(callbacks, teacherSchool); dialog.mount(parent);
    return { dialog, parent, callbacks };
}

function fill(parent: HTMLElement) {
    const tab = parent.querySelector<HTMLButtonElement>('#staff-tab-create');
    if (tab?.getAttribute('aria-selected') !== 'true') tab?.click();
    parent.querySelector<HTMLInputElement>('#admin-access-name')!.value = 'Pengelola baru';
    parent.querySelector<HTMLInputElement>('#admin-access-username')!.value = 'pengelola.baru';
    parent.querySelector<HTMLInputElement>('#admin-access-password')!.value = crypto.randomUUID();
    const school = parent.querySelector<HTMLSelectElement>('#admin-access-school');
    if (!school) return;
    if ([...school.options].some(option => option.value === existing.schoolName)) school.value = existing.schoolName!;
    else {
        school.value = '__new_school__'; school.dispatchEvent(new Event('change'));
        parent.querySelector<HTMLInputElement>('#admin-access-new-school')!.value = existing.schoolName!;
    }
}

function submit(parent: HTMLElement) { parent.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }

describe('AdminAccessDialog', () => {
    it('blocks navigation and another mutation while account creation is pending', async () => {
        const account: AdminAccessItem = { ...existing, role: 'teacher', username: 'guru.satu' };
        const { dialog, parent, callbacks } = setup([account]); await dialog.show([]); fill(parent);
        let resolve!: (value: object) => void;
        callbacks.onCreate.mockReturnValue(new Promise(done => { resolve = done; }));
        submit(parent);
        const list = parent.querySelector<HTMLButtonElement>('#staff-tab-list')!;
        const edit = parent.querySelector<HTMLButtonElement>('[aria-label="Edit @guru.satu"]')!;
        expect(list.disabled).toBe(true); expect(edit.disabled).toBe(true);
        list.click(); edit.click();
        expect(parent.querySelector('#staff-tab-create')?.getAttribute('aria-selected')).toBe('true');
        expect(parent.querySelector('.admin-access-editor')).toBeNull();
        resolve({});
        await vi.waitFor(() => expect(list.disabled).toBe(false));
        expect(parent.querySelector<HTMLElement>('#staff-panel-list')?.hidden).toBe(false);
        expect(parent.querySelector<HTMLElement>('#staff-panel-create')?.hidden).toBe(true);
        expect(parent.querySelector('.admin-access-editor')).toBeNull();
    });
    it('opens with a searchable account list and keeps create and edit in separate focused screens', async () => {
        const account: AdminAccessItem = { ...existing, role: 'teacher', username: 'guru.satu' };
        const { dialog, parent } = setup([account]); await dialog.show([]);
        expect(parent.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Daftar akun');
        expect(parent.querySelector<HTMLElement>('#staff-panel-create')?.hidden).toBe(true);
        const search = parent.querySelector<HTMLInputElement>('#staff-account-search')!;
        search.value = 'tidak ada'; search.dispatchEvent(new Event('input'));
        expect(parent.querySelectorAll('.admin-account-card')).toHaveLength(0);
        expect(parent.textContent).toContain('Tidak ada akun yang cocok');
        search.value = 'guru.satu'; search.dispatchEvent(new Event('input'));
        parent.querySelector<HTMLButtonElement>('[aria-label="Edit @guru.satu"]')!.click();
        expect(parent.querySelector<HTMLElement>('#staff-panel-list')?.hidden).toBe(true);
        expect(parent.querySelector<HTMLElement>('#staff-panel-create')?.hidden).toBe(true);
        [...parent.querySelectorAll('button')].find(button => button.textContent === 'Kembali ke daftar')!.click();
        expect(parent.querySelector('.admin-access-editor')).toBeNull();
        expect(parent.querySelector<HTMLElement>('#staff-panel-list')?.hidden).toBe(false);
    });

    it('lets school administrators edit, reset and delete only teachers from their own school', async () => {
        const teacher: AdminAccessItem = { ...existing, role: 'teacher', username: 'guru.sekolah', userId: 'teacher-id' };
        const { dialog, parent, callbacks } = setup([teacher, { ...teacher, userId: 'outside', username: 'guru.lain', schoolName: 'SDN LAIN' }, { ...teacher, userId: 'forum', role: 'forum', username: 'forum.lain' }, existing], existing.schoolName);
        await dialog.show([]);
        expect(parent.querySelectorAll('.admin-account-card')).toHaveLength(1);
        expect(parent.textContent).not.toContain('@guru.lain');
        expect(parent.textContent).not.toContain('@forum.lain');
        expect(parent.querySelectorAll('.admin-account-card button')).toHaveLength(3);
        parent.querySelector<HTMLButtonElement>('[aria-label="Edit @guru.sekolah"]')!.click();
        parent.querySelector<HTMLInputElement>('#staff-edit-name')!.value = 'Guru Baru';
        parent.querySelector('.admin-access-editor')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await vi.waitFor(() => expect(callbacks.onUpdate).toHaveBeenCalledWith('teacher-id', expect.objectContaining({ displayName: 'Guru Baru' })));
        await vi.waitFor(() => expect(parent.querySelector('.admin-access-editor')).toBeNull());
        parent.querySelector<HTMLButtonElement>('[aria-label="Reset password @guru.sekolah"]')!.click();
        const password = crypto.randomUUID();
        parent.querySelector<HTMLInputElement>('#staff-new-password')!.value = password;
        parent.querySelector<HTMLInputElement>('#staff-confirm-password')!.value = password;
        parent.querySelector('.admin-access-editor')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await vi.waitFor(() => expect(callbacks.onResetPassword).toHaveBeenCalledWith('teacher-id', password));
        await vi.waitFor(() => expect(parent.querySelector('.admin-access-editor')).toBeNull());
        parent.querySelector<HTMLButtonElement>('[aria-label="Hapus @guru.sekolah"]')!.click();
        const confirmation = parent.querySelector<HTMLInputElement>('#staff-delete-confirmation')!;
        confirmation.value = teacher.username; confirmation.dispatchEvent(new Event('input'));
        parent.querySelector('.admin-access-editor')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await vi.waitFor(() => expect(callbacks.onDelete).toHaveBeenCalledWith('teacher-id', teacher.username));
    });
    it('edits only teacher and forum identities and refreshes the registered list', async () => {
        const teacher: AdminAccessItem = { ...existing, role: 'teacher', username: 'guru.satu' };
        const { dialog, parent, callbacks } = setup([teacher]);
        await dialog.show([]);
        parent.querySelector<HTMLButtonElement>('[aria-label="Edit @guru.satu"]')!.click();
        parent.querySelector<HTMLInputElement>('#staff-edit-name')!.value = 'Guru Diperbarui';
        parent.querySelector<HTMLInputElement>('#staff-edit-username')!.value = 'guru.baru';
        callbacks.onList.mockResolvedValue([{ ...teacher, displayName: 'Guru Diperbarui', username: 'guru.baru' }]);
        parent.querySelector('.admin-access-editor')!.dispatchEvent(new Event('submit', { cancelable: true }));
        await vi.waitFor(() => expect(callbacks.onUpdate).toHaveBeenCalledWith(teacher.userId, { displayName: 'Guru Diperbarui', username: 'guru.baru', expectedUsername: 'guru.satu' }));
        await vi.waitFor(() => expect(parent.querySelector('.admin-account-list')?.textContent).toContain('@guru.baru'));
        expect(parent.querySelector('.admin-access-editor')).toBeNull();
    });

    it('confirms staff password changes and clears secrets after a failure', async () => {
        const account: AdminAccessItem = { ...existing, role: 'forum', username: 'forum.satu', schoolName: null };
        const { dialog, parent, callbacks } = setup([account]); await dialog.show([]);
        parent.querySelector<HTMLButtonElement>('[aria-label="Reset password @forum.satu"]')!.click();
        const first = parent.querySelector<HTMLInputElement>('#staff-new-password')!;
        const second = parent.querySelector<HTMLInputElement>('#staff-confirm-password')!;
        const credential = crypto.randomUUID(); first.value = credential; second.value = `${credential}-beda`;
        const form = parent.querySelector('.admin-access-editor')!;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(callbacks.onResetPassword).not.toHaveBeenCalled();
        expect(form.querySelector('[role="alert"]')?.textContent).toContain('tidak sama');
        callbacks.onResetPassword.mockRejectedValue(new Error('Koneksi terputus.')); second.value = credential;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        await vi.waitFor(() => expect(callbacks.onResetPassword).toHaveBeenCalledWith(account.userId, credential));
        await vi.waitFor(() => expect(first.value).toBe(''));
        expect(second.value).toBe(''); expect(parent.textContent).not.toContain(credential);
        expect(form.querySelector('[role="alert"]')?.textContent).toContain('Koneksi terputus');
    });

    it('requires the exact username before deleting a staff account and ignores duplicate submissions', async () => {
        const account: AdminAccessItem = { ...existing, role: 'teacher', username: 'guru.hapus' };
        const { dialog, parent, callbacks } = setup([account]); await dialog.show([]);
        parent.querySelector<HTMLButtonElement>('[aria-label="Hapus @guru.hapus"]')!.click();
        const form = parent.querySelector<HTMLFormElement>('.admin-access-editor')!;
        const confirmation = form.querySelector<HTMLInputElement>('#staff-delete-confirmation')!;
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        expect(button.disabled).toBe(true);
        confirmation.value = 'guru.lain'; confirmation.dispatchEvent(new Event('input')); expect(button.disabled).toBe(true);
        form.dispatchEvent(new Event('submit', { cancelable: true })); expect(callbacks.onDelete).not.toHaveBeenCalled();
        confirmation.value = account.username; confirmation.dispatchEvent(new Event('input')); expect(button.disabled).toBe(false);
        let resolve!: (value: object) => void; callbacks.onDelete.mockReturnValue(new Promise(done => { resolve = done; }));
        form.dispatchEvent(new Event('submit', { cancelable: true })); form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(callbacks.onDelete).toHaveBeenCalledTimes(1); expect(callbacks.onDelete).toHaveBeenCalledWith(account.userId, account.username);
        callbacks.onList.mockResolvedValue([]); resolve({});
        await vi.waitFor(() => expect(parent.querySelector('.admin-account-list')?.textContent).not.toContain('@guru.hapus'));
    });

    it('offers school and master profile/password controls but protects master deletion', async () => {
        const { dialog, parent } = setup([{ ...existing, role: 'master' }, existing]); await dialog.show([]);
        const cards=parent.querySelectorAll('.admin-account-card');
        expect(cards[0].querySelectorAll('button')).toHaveLength(2);
        expect(cards[0].textContent).not.toContain('Hapus');
        expect(cards[1].querySelectorAll('button')).toHaveLength(3);
        dialog.close();
        const callbacks = { onCreate: vi.fn(), onList: vi.fn().mockResolvedValue([{ ...existing, role: 'teacher' }]), onUpdate: vi.fn(), onResetPassword: vi.fn(), onDelete: vi.fn() };
        const scoped = new AdminAccessDialog(callbacks, existing.schoolName); scoped.mount(parent); await scoped.show([]);
        expect(parent.querySelectorAll('.admin-account-card button')).toHaveLength(3);
    });
    it('locks school administrators to creating teachers at their verified school', async () => {
        const parent = document.createElement('div'); document.body.append(parent);
        const callbacks = { onCreate:vi.fn().mockResolvedValue({}),onList:vi.fn().mockResolvedValue([]) };
        const dialog = new AdminAccessDialog(callbacks, existing.schoolName); dialog.mount(parent); await dialog.show(['SDN LAIN']);
        fill(parent);
        expect(parent.querySelector('#admin-access-role')).toBeNull();
        expect(parent.querySelector('#admin-access-school')).toBeNull();
        expect(parent.querySelector('.staff-scope-context')?.textContent).toContain(existing.schoolName);
        expect(parent.querySelector('.staff-scope-context')?.textContent).toContain('Guru'); submit(parent);
        expect(callbacks.onCreate).toHaveBeenCalledWith(expect.objectContaining({ role:'teacher',schoolName:existing.schoolName }));
    });
    beforeEach(() => {
        document.body.replaceChildren();
        Object.defineProperties(HTMLDialogElement.prototype, {
            showModal: { configurable: true, value() { this.setAttribute('open', ''); } },
            close: { configurable: true, value() { this.removeAttribute('open'); } }
        });
    });

    it('offers registered schools in a required dropdown and includes schools with staff but no students', async () => {
        const { dialog, parent, callbacks } = setup([existing]);
        await dialog.show(['SDN DUA', ' sdn dua ']);
        fill(parent);
        const school = parent.querySelector<HTMLSelectElement>('select#admin-access-school');
        expect(school).not.toBeNull();
        expect([...school!.options].map(option => option.value)).toEqual(['', 'SDN DUA', existing.schoolName, '__new_school__']);
        expect(parent.querySelector('datalist')).toBeNull();
        fill(parent); school!.value = ''; submit(parent);
        expect(callbacks.onCreate).not.toHaveBeenCalled();
    });

    it('requires an explicit new school and hides it for forum access', async () => {
        const { dialog, parent, callbacks } = setup(); await dialog.show([]); fill(parent);
        const school = parent.querySelector<HTMLSelectElement>('#admin-access-school')!;
        const added = parent.querySelector<HTMLInputElement>('#admin-access-new-school')!;
        added.value = ''; submit(parent); expect(callbacks.onCreate).not.toHaveBeenCalled();
        added.value = '  sdn baru  '; submit(parent);
        expect(callbacks.onCreate).toHaveBeenCalledWith(expect.objectContaining({ schoolName: 'SDN BARU' }));
        await vi.waitFor(() => expect(parent.textContent).toContain('berhasil dibuat'));
        expect([...school.options].some(option => option.value === 'SDN BARU')).toBe(true);
        expect(added.closest<HTMLElement>('.field-group')!.hidden).toBe(true);
        const role = parent.querySelector<HTMLSelectElement>('#admin-access-role')!;
        role.value = 'teacher'; role.dispatchEvent(new Event('change'));
        expect(parent.querySelector('#admin-access-scope-hint')?.textContent).toContain('lebih dari satu akun guru');
        school.value = '__new_school__'; school.dispatchEvent(new Event('change'));
        role.value = 'forum'; role.dispatchEvent(new Event('change'));
        expect(added.disabled).toBe(true); expect(added.required).toBe(false);
        expect(added.closest<HTMLElement>('.field-group')!.hidden).toBe(true);
    });

    it('lists existing access as text and rejects a second administrator for the same school', async () => {
        const { dialog, parent, callbacks } = setup([existing, { ...existing, userId: 'unsafe', displayName: '<img src=x onerror=bad()>' }]);
        await dialog.show([existing.schoolName!]); fill(parent); submit(parent);
        expect(callbacks.onCreate).not.toHaveBeenCalled();
        expect(parent.querySelector('[role="alert"]')?.textContent).toContain('sudah dibuat');
        expect(parent.querySelector('.admin-account-list img')).toBeNull();
        expect(parent.textContent).toContain('<img src=x onerror=bad()>');
    });

    it('creates teacher access for a school that already has its administrator', async () => {
        const { dialog, parent, callbacks } = setup([existing]); await dialog.show([existing.schoolName!]); fill(parent);
        const role = parent.querySelector<HTMLSelectElement>('#admin-access-role')!; role.value = 'teacher'; role.dispatchEvent(new Event('change'));
        submit(parent);
        expect(callbacks.onCreate).toHaveBeenCalledWith(expect.objectContaining({ role: 'teacher', schoolName: existing.schoolName }));
        await vi.waitFor(() => expect(parent.querySelector<HTMLInputElement>('#admin-access-password')?.value).toBe(''));
        expect(parent.textContent).toContain('berhasil dibuat');
    });

    it('omits school scope for forum accounts and clears the credential after failure', async () => {
        const { dialog, parent, callbacks } = setup(); callbacks.onCreate.mockRejectedValue(new Error('Username sudah digunakan.'));
        await dialog.show([]); fill(parent);
        const role = parent.querySelector<HTMLSelectElement>('#admin-access-role')!; role.value = 'forum'; role.dispatchEvent(new Event('change'));
        expect(parent.querySelector<HTMLInputElement>('#admin-access-school')!.disabled).toBe(true);
        submit(parent);
        expect(callbacks.onCreate).toHaveBeenCalledWith(expect.objectContaining({ role: 'forum' }));
        expect(callbacks.onCreate.mock.calls[0][0]).not.toHaveProperty('schoolName');
        await vi.waitFor(() => expect(parent.querySelector('[role="alert"]')?.textContent).toContain('Username sudah digunakan'));
        await vi.waitFor(() => expect(parent.querySelector<HTMLInputElement>('#admin-access-password')?.value).toBe(''));
    });

    it('blocks duplicate submissions and destroys form credentials when closed', async () => {
        const { dialog, parent, callbacks } = setup(); callbacks.onCreate.mockReturnValue(new Promise(() => {}));
        await dialog.show([]); fill(parent); submit(parent); submit(parent);
        expect(callbacks.onCreate).toHaveBeenCalledOnce();
        dialog.close(); expect(parent.querySelector('input[type="password"]')).toBeNull();
    });

    it('ignores an account-list response after closing and restores focus', async () => {
        const { dialog, parent, callbacks } = setup();
        const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
        let resolve!: (items: AdminAccessItem[]) => void;
        callbacks.onList.mockReturnValue(new Promise<AdminAccessItem[]>(done => { resolve = done; }));
        const showing = dialog.show([]); dialog.close(); resolve([existing]); await showing;
        expect(parent.querySelector('form')).toBeNull(); expect(document.activeElement).toBe(trigger);
    });

    it('does not expose a create form when the authorized list request fails', async () => {
        const { dialog, parent, callbacks } = setup(); callbacks.onList.mockRejectedValue(new Error('forbidden'));
        await dialog.show([]); expect(parent.querySelector('form')).toBeNull(); expect(parent.textContent).toContain('belum dapat dimuat');
    });

    it('keeps a successful creation visible when refreshing the staff list fails', async () => {
        const { dialog, parent, callbacks } = setup();
        callbacks.onList.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
        await dialog.show([]); fill(parent); submit(parent);
        await vi.waitFor(() => expect(parent.textContent).toContain('Buka kembali menu ini'));
        expect(parent.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('');
    });

    it('never repaints a dismissed form when a create request completes late', async () => {
        const { dialog, parent, callbacks } = setup();
        let resolve!: (value: object) => void;
        callbacks.onCreate.mockReturnValue(new Promise<object>(done => { resolve = done; }));
        await dialog.show([]); fill(parent); submit(parent); dialog.close(); resolve({});
        await vi.waitFor(() => expect(parent.querySelector('form')).toBeNull());
        expect(callbacks.onList).toHaveBeenCalledTimes(1);
    });

    it('traps keyboard focus, renders each staff role, and closes through cancel and backdrop', async () => {
        const { dialog, parent } = setup(['master','forum','teacher'].map((role,index) => ({...existing,role:role as AdminAccessItem['role'],userId:String(index),schoolName:role==='teacher'?'SDN SATU':null})));
        await dialog.show([]);
        expect(parent.textContent).toContain('Master'); expect(parent.textContent).toContain('Forum / dinas'); expect(parent.textContent).toContain('Guru');
        const controls=[...parent.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(control=>!control.closest('[hidden]'));
        const first=controls[0],last=controls[controls.length-1]; first.focus();
        first.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
        expect(document.activeElement).toBe(last);
        last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
        expect(document.activeElement).toBe(first);
        parent.querySelector('dialog')!.dispatchEvent(new Event('cancel',{cancelable:true}));
        expect(parent.querySelector('dialog')!.open).toBe(false);
        await dialog.show([]); parent.querySelector('dialog')!.click();
        expect(parent.querySelector('dialog')!.open).toBe(false);
    });

    it('reports a safe message for non-Error failures and ignores late listing errors', async () => {
        const { dialog,parent,callbacks }=setup(); callbacks.onCreate.mockRejectedValue('internal');
        await dialog.show([]); fill(parent); submit(parent);
        await vi.waitFor(()=>expect(parent.querySelector('[role="alert"]')?.textContent).toContain('belum dapat dibuat'));
        let reject!: (error: Error)=>void;
        callbacks.onList.mockReturnValue(new Promise((_resolve,fail)=>{reject=fail;}));
        const showing=dialog.show([]); dialog.close(); reject(new Error('late')); await showing;
        expect(parent.textContent).not.toContain('late');
    });
});
