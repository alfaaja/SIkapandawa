import { Scene } from 'phaser';
import { addBackground, addImageIfExists, applyLogicalCamera } from '../ui/backdrop';
import { makeText } from '../ui/fonts';
import { SpriteButton } from '../ui/SpriteButton';
import { MessageModal } from '../ui/MessageModal';
import { AuthForm } from '../ui/AuthForm';
import { AuthService } from '../services/AuthService';
import { ProgressService } from '../services/ProgressService';
import { BackgroundMusicService } from '../services/BackgroundMusicService';
import { MAX_SCHOOL_NAME_LENGTH } from '../../shared/auth/school';

const PANEL_CENTER_X = 648;
const TEXTBOX_X = 445;   // kiri sprite textbox-daftar (406x295)
const TEXTBOX_Y = 221;   // atas sprite, memberi ruang untuk nama sekolah
const FIELD_X = TEXTBOX_X + 204;
const FIELD_W = 366;
const FIELD_H = 32;

/**
 * Register — membuat akun lokal + progress awal, lalu ke Level Select.
 * Field mengikuti aset, dengan nama sekolah untuk pengelompokan di panel admin.
 */
export class Register extends Scene {
    private form: AuthForm;
    private modal: MessageModal;
    private submitButton: SpriteButton;
    private processing = false;

    constructor() {
        super('Register');
    }

    create(): void {
        BackgroundMusicService.stop(this);
        this.processing = false;
        applyLogicalCamera(this);
        this.cameras.main.fadeIn(250, 255, 244, 214);
        addBackground(this, 'bg-panel-empty');
        addImageIfExists(this, PANEL_CENTER_X, 116, 'logo-panel')?.setDisplaySize(146, 180);

        const textbox = addImageIfExists(this, TEXTBOX_X + 203, TEXTBOX_Y + 147, 'textbox-daftar');
        if (!textbox) {
            makeText(this, PANEL_CENTER_X, TEXTBOX_Y + 147, 'Formulir pendaftaran', 16)
                .setOrigin(0.5);
        }

        this.modal = new MessageModal(this);
        makeText(this, TEXTBOX_X + 1, 526, 'Nama Sekolah:', 13, { color: '#ffffff' })
            .setStroke('#171717', 3);
        this.add.graphics()
            .fillStyle(0xf0c1ff, 1)
            .lineStyle(3, 0x7b229c, 1)
            .fillRoundedRect(TEXTBOX_X + 3, 551, 400, 42, 10)
            .strokeRoundedRect(TEXTBOX_X + 3, 551, 400, 42, 10);
        this.form = new AuthForm(this, [
            { id: 'displayName', type: 'text', x: FIELD_X, y: TEXTBOX_Y + 46, width: FIELD_W, height: FIELD_H, maxLength: 24 },
            { id: 'username', type: 'text', x: FIELD_X, y: TEXTBOX_Y + 121, width: FIELD_W, height: FIELD_H, maxLength: 20 },
            { id: 'password', type: 'password', x: FIELD_X, y: TEXTBOX_Y + 196, width: FIELD_W, height: FIELD_H, maxLength: 64 },
            { id: 'passwordConfirm', type: 'password', x: FIELD_X, y: TEXTBOX_Y + 271, width: FIELD_W, height: FIELD_H, maxLength: 64 },
            { id: 'schoolName', label: 'Nama sekolah', type: 'text', x: FIELD_X, y: 572, width: FIELD_W, height: FIELD_H, maxLength: MAX_SCHOOL_NAME_LENGTH }
        ], () => this.submit());

        this.submitButton = new SpriteButton(this, PANEL_CENTER_X, 621, 'button-daftar', () => this.submit());

        const back = makeText(this, 414, 26, '‹ Kembali', 12, { color: '#9441c0' })
            .setInteractive({ useHandCursor: true });
        back.on('pointerover', () => back.setColor('#630995'));
        back.on('pointerout', () => back.setColor('#9441c0'));
        back.on('pointerup', () => {
            if (!this.processing && !this.modal.isOpen) this.goTo('MainMenu');
        });
    }

    /** Tampilkan modal sambil menyembunyikan input DOM agar tidak melayang di atas modal. */
    private showFormError(message: string): void {
        this.form.setVisible(false);
        this.modal.show(message, () => this.form.setVisible(true));
    }

    private async submit(): Promise<void> {
        if (this.processing || this.modal.isOpen) return;

        const password = this.form.value('password');
        const confirm = this.form.value('passwordConfirm');
        if (password !== confirm) {
            this.showFormError('Ulangi password harus sama dengan password.');
            return;
        }

        this.processing = true;
        this.submitButton.setEnabled(false);
        this.form.setEnabled(false);

        const result = await AuthService.register(
            this.form.value('displayName'),
            this.form.value('username'),
            password,
            this.form.value('schoolName')
        );

        if (!result.ok) {
            this.processing = false;
            this.submitButton.setEnabled(true);
            this.form.setEnabled(true);
            this.showFormError(result.error);
            return;
        }

        await ProgressService.hydrate(result.account.id);

        this.goTo('LevelSelect');
    }

    private goTo(sceneKey: string): void {
        this.form.destroy();
        this.cameras.main.fadeOut(200, 255, 244, 214);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(sceneKey);
        });
    }
}
