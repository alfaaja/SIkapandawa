import { GameObjects, Input, Scene, Time } from 'phaser';
import {
    createJejakRun,
    JEJAK_BASKETS,
    JejakBasket,
    JejakCard
} from '../data/jejakPandawa';
import { AuthService } from '../services/AuthService';
import { ProgressService } from '../services/ProgressService';
import { SettingsStorageService } from '../services/SettingsStorageService';
import { BackgroundMusicService } from '../services/BackgroundMusicService';
import { addBackground, addImageIfExists, applyLogicalCamera } from '../ui/backdrop';
import { makeText } from '../ui/fonts';
import { PauseOverlay } from '../ui/PauseOverlay';
import { SpriteButton } from '../ui/SpriteButton';

type JejakState =
    | 'CARD_ACTIVE'
    | 'CARD_SELECTED'
    | 'DRAGGING'
    | 'FEEDBACK'
    | 'PAUSED'
    | 'COMPLETE';

interface JejakKeys {
    left: Input.Keyboard.Key;
    right: Input.Keyboard.Key;
    a: Input.Keyboard.Key;
    d: Input.Keyboard.Key;
    e: Input.Keyboard.Key;
    space: Input.Keyboard.Key;
    enter: Input.Keyboard.Key;
    esc: Input.Keyboard.Key;
    m: Input.Keyboard.Key;
}

const CARD_X = 640;
const CARD_Y = 302;
const CARD_W = 790;
const CARD_H = 173;
const FEEDBACK_MS = 800;
const GOOD_ZONE = { x: 405, y: 581, width: 370, height: 238 };
const BAD_ZONE = { x: 875, y: 581, width: 370, height: 238 };

/**
 * Mini-game klasifikasi perilaku. Setiap run mengambil tepat dua kartu dari
 * masing-masing Pandawa, lalu pemain mengirim kartu ke keranjang Baik/Buruk.
 */
export class JejakPandawa extends Scene {
    private accountId = '';
    private runCards: JejakCard[] = [];
    private cardIndex = 0;
    private score = 0;
    private state: JejakState = 'CARD_ACTIVE';
    private stateBeforePause: JejakState = 'CARD_ACTIVE';
    private selectedBasket: JejakBasket['id'] = 'good';
    private cardSelected = false;
    private inputLocked = false;
    private hasInteracted = false;
    private pointerDownX = 0;
    private pointerDownY = 0;

    private cardImage: GameObjects.Image | null = null;
    private cardText: GameObjects.Text | null = null;
    private goodZone: GameObjects.Zone;
    private badZone: GameObjects.Zone;
    private feedbackText: GameObjects.Text;
    private instructionText: GameObjects.Text;
    private muteButton: SpriteButton;
    private pauseOverlay: PauseOverlay;
    private keys: JejakKeys;
    private feedbackTimer: Time.TimerEvent | null = null;

    constructor() {
        super('JejakPandawa');
    }

    create(): void {
        const account = AuthService.getActiveAccount();
        if (!account) {
            this.scene.start('MainMenu');
            return;
        }
        const progress = ProgressService.getProgress(account.id);
        if (!progress.jejakPandawaUnlocked) {
            this.scene.start('LevelSelect');
            return;
        }
        this.accountId = account.id;
        this.resetRunState();

        applyLogicalCamera(this);
        BackgroundMusicService.ensurePlaying(this);
        addBackground(this, 'jejak-background');
        this.cameras.main.fadeIn(220, 245, 255, 214);

        this.runCards = createJejakRun();
        this.pauseOverlay = new PauseOverlay(this, 'jejak');
        this.drawHud(account.username);
        this.drawBaskets();

        this.keys = this.input.keyboard!.addKeys(
            'left,right,a,d,e,space,enter,esc,m'
        ) as unknown as JejakKeys;
        this.bindKeyboard();

        this.showCurrentCard();
    }

    private resetRunState(): void {
        this.cardIndex = 0;
        this.score = 0;
        this.state = 'CARD_ACTIVE';
        this.stateBeforePause = 'CARD_ACTIVE';
        this.selectedBasket = 'good';
        this.cardSelected = false;
        this.inputLocked = false;
        this.hasInteracted = false;
        this.pointerDownX = 0;
        this.pointerDownY = 0;
        this.feedbackTimer = null;
        this.cardImage = null;
        this.cardText = null;
    }

    private bindKeyboard(): void {
        this.keys.left.on('down', () => this.selectBasket('good'));
        this.keys.a.on('down', () => this.selectBasket('good'));
        this.keys.right.on('down', () => this.selectBasket('bad'));
        this.keys.d.on('down', () => this.selectBasket('bad'));
        this.keys.enter.on('down', () => this.submitBasket(this.selectedBasket));
        this.keys.space.on('down', () => this.submitBasket(this.selectedBasket));
        this.keys.e.on('down', () => this.submitBasket(this.selectedBasket));
        this.keys.m.on('down', () => this.toggleMute());
        this.keys.esc.on('down', () => {
            if (this.state === 'PAUSED') this.resumeGame();
            else this.pauseGame();
        });
    }

    private drawHud(username: string): void {
        const userPanel = this.add.image(150, 47, 'jejak-user-panel')
            .setDisplaySize(270, 47).setDepth(100);
        if (!this.textures.exists('jejak-user-panel')) userPanel.setVisible(false);

        const nickname = username.length > 15 ? `${username.slice(0, 14)}…` : username;
        makeText(this, 150, 47, nickname, 18, { color: '#000000' })
            .setOrigin(0.5).setDepth(101);

        const menuPanel = this.add.image(1070, 51, 'jejak-menu-panel')
            .setDisplaySize(380, 56).setDepth(100);
        if (!this.textures.exists('jejak-menu-panel')) menuPanel.setVisible(false);
        const menuLabel = addImageIfExists(this, 976, 51, 'label-sikapandawa');
        if (menuLabel) {
            menuLabel.setDisplaySize(150, 35).setDepth(101);
        } else {
            makeText(this, 976, 51, 'SIKAPANDAWA', 12)
                .setOrigin(0.5).setDepth(101);
        }

        new SpriteButton(
            this, 1092, 51, 'jejak-button-pause', () => this.pauseGame(), 38, 38
        ).setDepth(102);
        new SpriteButton(
            this, 1138, 51, 'jejak-button-quit', () => this.quitRun(), 38, 38
        ).setDepth(102);
        this.muteButton = new SpriteButton(
            this,
            1184,
            51,
            SettingsStorageService.getSettings().muted
                ? 'jejak-button-muted'
                : 'jejak-button-unmuted',
            () => this.toggleMute(),
            38,
            38
        ).setDepth(102);
        new SpriteButton(
            this, 1230, 51, 'jejak-button-replay', () => this.restartRun(), 38, 38
        ).setDepth(102);

        makeText(
            this,
            640,
            115,
            'Masukkan kartu ke keranjang perilaku BAIK atau BURUK',
            13,
            { align: 'center' }
        ).setOrigin(0.5).setDepth(10);
        this.instructionText = makeText(
            this,
            640,
            430,
            'Drag kartu, atau tap kartu lalu tap keranjang  •  A/D + ENTER',
            9,
            { align: 'center' }
        ).setOrigin(0.5).setDepth(10);
        this.feedbackText = makeText(this, 640, 420, '', 12, {
            align: 'center'
        }).setOrigin(0.5).setDepth(10);
    }

    private drawBaskets(): void {
        const baskets = this.add.image(640, 584, 'jejak-baskets')
            .setDisplaySize(900, 284).setDepth(2);
        if (!this.textures.exists('jejak-baskets')) baskets.setVisible(false);

        this.goodZone = this.add.zone(
            GOOD_ZONE.x, GOOD_ZONE.y, GOOD_ZONE.width, GOOD_ZONE.height
        ).setRectangleDropZone(GOOD_ZONE.width, GOOD_ZONE.height).setName('good').setDepth(4);
        this.badZone = this.add.zone(
            BAD_ZONE.x, BAD_ZONE.y, BAD_ZONE.width, BAD_ZONE.height
        ).setRectangleDropZone(BAD_ZONE.width, BAD_ZONE.height).setName('bad').setDepth(4);

        this.goodZone.on('pointerup', () => this.submitTappedBasket('good'));
        this.badZone.on('pointerup', () => this.submitTappedBasket('bad'));
    }

    private showCurrentCard(): void {
        this.destroyCard();
        this.inputLocked = false;
        this.cardSelected = false;
        this.selectedBasket = 'good';
        this.state = 'CARD_ACTIVE';
        this.feedbackText.setText('');
        if (this.hasInteracted) {
            this.instructionText.setText('');
        } else {
            this.instructionText.setText(
                'Drag kartu, atau tap kartu lalu tap keranjang  •  A/D + ENTER'
            );
        }
        const card = this.runCards[this.cardIndex];
        if (!card) {
            this.finishRun();
            return;
        }

        this.cardImage = this.add.image(CARD_X, CARD_Y, 'jejak-card')
            .setDisplaySize(CARD_W, CARD_H).setDepth(20)
            .setInteractive({ useHandCursor: true });
        this.input.setDraggable(this.cardImage);

        this.cardText = makeText(this, CARD_X - 70, CARD_Y - 23, card.text, 14, {
            color: '#000000',
            align: 'center',
            wordWrapWidth: 590,
            lineSpacing: 8
        }).setOrigin(0.5, 0).setDepth(21);

        this.cardImage.on('pointerdown', (pointer: Input.Pointer) => {
            this.hideInitialInstruction();
            this.pointerDownX = pointer.x;
            this.pointerDownY = pointer.y;
        });
        this.cardImage.on('pointerup', (pointer: Input.Pointer) => {
            const movement = Math.hypot(
                pointer.x - this.pointerDownX,
                pointer.y - this.pointerDownY
            );
            if (this.inputLocked || movement > 12 || this.state === 'PAUSED') return;
            this.cardSelected = true;
            this.state = 'CARD_SELECTED';
            this.cardImage?.setTint(0xfff1a8);
        });
        this.cardImage.on('dragstart', () => {
            if (this.inputLocked || this.state === 'PAUSED') return;
            this.hideInitialInstruction();
            this.state = 'DRAGGING';
            this.cardImage?.setDepth(40);
            this.cardText?.setDepth(41);
        });
        this.cardImage.on('drag', (_pointer: Input.Pointer, dragX: number, dragY: number) => {
            if (this.inputLocked || this.state !== 'DRAGGING') return;
            this.positionCardVisual(dragX, dragY);
        });
        this.cardImage.on(
            'drop',
            (_pointer: Input.Pointer, target: GameObjects.GameObject) => {
                if (this.inputLocked || this.state === 'PAUSED') return;
                const basketId = target.name === 'bad' ? 'bad' : 'good';
                this.submitBasket(basketId);
            }
        );
        this.cardImage.on(
            'dragend',
            (
                _pointer: Input.Pointer,
                _dragX: number,
                _dragY: number,
                dropped: boolean
            ) => {
            if (!dropped && !this.inputLocked && this.state !== 'PAUSED') {
                this.returnCardToOrigin();
                this.state = this.cardSelected ? 'CARD_SELECTED' : 'CARD_ACTIVE';
            }
            }
        );
    }

    private submitTappedBasket(basketId: JejakBasket['id']): void {
        if (!this.cardSelected || this.inputLocked || this.state === 'PAUSED') return;
        this.submitBasket(basketId);
    }

    private submitBasket(basketId: JejakBasket['id']): void {
        if (this.inputLocked || this.state === 'PAUSED' || this.state === 'COMPLETE') return;
        const card = this.runCards[this.cardIndex];
        const basket = JEJAK_BASKETS.find((item) => item.id === basketId);
        if (!card || !basket) return;

        this.inputLocked = true;
        this.state = 'FEEDBACK';
        this.cardImage?.disableInteractive();
        this.cardImage?.setVisible(false);
        this.cardText?.setVisible(false);
        const correct = basket.accepts === card.isGood;
        if (correct) this.score += 1;
        this.feedbackText
            .setColor(correct ? '#315e08' : '#8c0020')
            .setText(correct ? 'BENAR! Perilaku diklasifikasikan dengan tepat.' : 'BELUM TEPAT. Lanjut ke kartu berikutnya.');
        this.instructionText.setText('');

        this.feedbackTimer = this.time.delayedCall(FEEDBACK_MS, () => {
            this.feedbackTimer = null;
            this.cardIndex += 1;
            if (this.cardIndex >= this.runCards.length) this.finishRun();
            else this.showCurrentCard();
        });
    }

    private positionCardVisual(x: number, y: number): void {
        this.cardImage?.setPosition(Math.round(x), Math.round(y));
        this.cardText?.setPosition(Math.round(x - 70), Math.round(y - 23));
    }

    private returnCardToOrigin(): void {
        this.positionCardVisual(CARD_X, CARD_Y);
        this.cardImage?.setDepth(20);
        this.cardText?.setDepth(21);
    }

    private selectBasket(basketId: JejakBasket['id']): void {
        if (this.inputLocked || this.state === 'PAUSED') return;
        this.hideInitialInstruction();
        this.selectedBasket = basketId;
        this.cardSelected = true;
        this.state = 'CARD_SELECTED';
        this.cardImage?.setTint(0xfff1a8);
    }

    private hideInitialInstruction(): void {
        if (this.hasInteracted) return;
        this.hasInteracted = true;
        this.instructionText.setText('');
    }

    private pauseGame(): void {
        if (this.state === 'PAUSED' || this.state === 'COMPLETE') return;
        this.stateBeforePause = this.state === 'DRAGGING'
            ? (this.cardSelected ? 'CARD_SELECTED' : 'CARD_ACTIVE')
            : this.state;
        this.returnCardToOrigin();
        this.state = 'PAUSED';
        this.tweens.pauseAll();
        this.time.paused = true;
        this.pauseOverlay.show(SettingsStorageService.getSettings().muted, {
            onResume: () => this.resumeGame(),
            onReplay: () => this.restartRun(),
            onQuit: () => this.quitRun(),
            onToggleMute: () => this.toggleMute()
        });
    }

    private resumeGame(): void {
        if (this.state !== 'PAUSED') return;
        this.pauseOverlay.hide();
        this.time.paused = false;
        this.tweens.resumeAll();
        this.state = this.stateBeforePause;
    }

    private toggleMute(): void {
        const muted = !SettingsStorageService.getSettings().muted;
        SettingsStorageService.setMuted(muted);
        BackgroundMusicService.setMuted(this, muted);
        this.muteButton.image.setTexture(
            muted ? 'jejak-button-muted' : 'jejak-button-unmuted'
        );
        this.muteButton.image.setDisplaySize(38, 38);
        this.pauseOverlay.setMuted(muted);
    }

    private restartRun(): void {
        this.feedbackTimer?.remove(false);
        this.pauseOverlay?.hide();
        this.time.paused = false;
        this.tweens.resumeAll();
        this.scene.restart();
    }

    private quitRun(): void {
        this.feedbackTimer?.remove(false);
        this.pauseOverlay?.hide();
        this.time.paused = false;
        this.tweens.resumeAll();
        this.scene.start('LevelSelect');
    }

    private finishRun(): void {
        if (this.state === 'COMPLETE') return;
        this.state = 'COMPLETE';
        this.inputLocked = true;
        this.destroyCard();
        ProgressService.recordJejakResult(this.accountId, this.score);
        this.cameras.main.fadeOut(220, 20, 6, 40);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('JejakResult', { score: this.score });
        });
    }

    private destroyCard(): void {
        this.cardImage?.destroy();
        this.cardText?.destroy();
        this.cardImage = null;
        this.cardText = null;
    }

}
