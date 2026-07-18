import { Scene } from 'phaser';
import { addBackground, addImageIfExists } from '../ui/backdrop';
import { SpriteButton } from '../ui/SpriteButton';
import { MessageModal } from '../ui/MessageModal';
import { AuthForm } from '../ui/AuthForm';
import { AuthStorageService } from '../services/AuthStorageService';

const PANEL_CENTER_X = 648;
const TEXTBOX_X = 445;   // kiri sprite textbox-masuk (406x181)
const TEXTBOX_Y = 270;   // atas sprite
const FIELD_X = TEXTBOX_X + 204;
const FIELD_W = 366;
const FIELD_H = 32;

/**
 * Login — verifikasi akun lokal lalu ke Level Select.
 * Field mengikuti aset: Nama Panggilan, Nama Password.
 */
export class Login extends Scene {
    private form: AuthForm;
    private modal: MessageModal;
    private submitButton: SpriteButton;
    private processing = false;

    constructor() {
        super('Login');
    }

    create(): void {
        this.processing = false;
        this.cameras.main.fadeIn(250, 255, 244, 214);
        addBackground(this, 'bg-panel-empty');
        addImageIfExists(this, PANEL_CENTER_X, 130, 'logo-panel');

        const textbox = addImageIfExists(this, TEXTBOX_X + 203, TEXTBOX_Y + 90, 'textbox-masuk');
        if (!textbox) {
            this.add.text(PANEL_CENTER_X, TEXTBOX_Y + 90, 'Formulir masuk', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '20px',
                color: '#3a0a52'
            }).setOrigin(0.5);
        }

        this.modal = new MessageModal(this);
        this.form = new AuthForm(this, [
            { id: 'username', type: 'text', x: FIELD_X, y: TEXTBOX_Y + 46, width: FIELD_W, height: FIELD_H, maxLength: 20 },
            { id: 'password', type: 'password', x: FIELD_X, y: TEXTBOX_Y + 157, width: FIELD_W, height: FIELD_H, maxLength: 64 }
        ], () => this.submit());

        this.submitButton = new SpriteButton(this, PANEL_CENTER_X, 505, 'button-masuk', () => this.submit());

        const registerLink = this.add.text(PANEL_CENTER_X, 560, 'Belum punya akun? Daftar di sini', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#9441c0'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        registerLink.on('pointerover', () => registerLink.setColor('#630995'));
        registerLink.on('pointerout', () => registerLink.setColor('#9441c0'));
        registerLink.on('pointerup', () => {
            if (!this.processing && !this.modal.isOpen) this.goTo('Register');
        });

        const back = this.add.text(414, 26, '‹ Kembali', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#9441c0'
        }).setInteractive({ useHandCursor: true });
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

        const username = this.form.value('username').trim();
        const password = this.form.value('password');
        if (!username || !password) {
            this.showFormError('Nama panggilan dan password harus diisi.');
            return;
        }

        this.processing = true;
        this.submitButton.setEnabled(false);
        this.form.setEnabled(false);

        const account = await AuthStorageService.verifyLogin(username, password);
        if (!account) {
            this.processing = false;
            this.submitButton.setEnabled(true);
            this.form.setEnabled(true);
            this.showFormError('Akun tidak ditemukan atau password salah.');
            return;
        }

        if (!AuthStorageService.setActiveAccount(account.id)) {
            this.processing = false;
            this.submitButton.setEnabled(true);
            this.form.setEnabled(true);
            this.showFormError('Penyimpanan browser tidak tersedia. Coba lagi.');
            return;
        }

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
