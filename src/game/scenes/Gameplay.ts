import { Scene, GameObjects, Input } from 'phaser';
import {
    GameplayState, LevelDefinition, SegmentDefinition, InteractionDefinition, ScriptStep
} from '../types/gameplay';
import { LEVELS, speakersFor } from '../data/levels';
import { AuthStorageService } from '../services/AuthStorageService';
import { ProgressStorageService } from '../services/ProgressStorageService';
import { SettingsStorageService } from '../services/SettingsStorageService';
import { DialogBox } from '../ui/DialogBox';
import { ChoicePanel } from '../ui/ChoicePanel';
import { TouchControls } from '../ui/TouchControls';
import { Hud } from '../ui/Hud';
import { PauseOverlay } from '../ui/PauseOverlay';
import { applyLogicalCamera } from '../ui/backdrop';

const VIEWPORT_W = 1280;
const EXIT_RADIUS = 85;
const CAMERA_LERP = 0.14;
const FADE_MS = 280;

interface GameplayKeys {
    left: Input.Keyboard.Key;
    right: Input.Keyboard.Key;
    a: Input.Keyboard.Key;
    d: Input.Keyboard.Key;
    e: Input.Keyboard.Key;
    space: Input.Keyboard.Key;
    esc: Input.Keyboard.Key;
}

/**
 * Gameplay generik Level 1–4 (data-driven; tidak ada scene per level/kasus).
 * State machine: SCRIPTED → EXPLORE → DIALOG → CHOICE → FEEDBACK → … → COMPLETE.
 */
export class Gameplay extends Scene {
    private level: LevelDefinition;
    private prefix = 'lv1';
    private segmentIndex = 0;
    private state: GameplayState = 'EXPLORE';
    private stateBeforePause: GameplayState = 'EXPLORE';

    private player: GameObjects.Image;
    private seated = false;
    private actorMap = new Map<string, GameObjects.Image>();
    private objectMap = new Map<string, GameObjects.Image>();
    private worldObjects: GameObjects.GameObject[] = [];
    private marker: GameObjects.Image | null = null;

    private dialog: DialogBox;
    private choicePanel: ChoicePanel;
    private touch: TouchControls;
    private hud: Hud;
    private pauseOverlay: PauseOverlay;
    private keys: GameplayKeys;
    /** Semua objek world berada di container ini; digeser (bukan kamera) untuk
     *  camera-follow, sehingga kamera tetap statis dan input UI tetap akurat. */
    private worldLayer: GameObjects.Container;
    private scrollX = 0;

    private starsEarned = 0;
    private resolvedIds = new Set<string>();
    private wrongIds = new Set<string>();
    private activeInteraction: InteractionDefinition | null = null;
    private scriptedWalk: { targetX: number; speed: number; resolve: () => void } | null = null;
    private walkTimer = 0;
    private walkFrame = 0;
    private transitioning = false;

    constructor() {
        super('Gameplay');
    }

    init(data: { levelId?: number }): void {
        this.level = LEVELS[data.levelId ?? 1] ?? LEVELS[1];
        this.prefix = this.level.assetPrefix;
        this.segmentIndex = 0;
        this.starsEarned = 0;
        this.resolvedIds.clear();
        this.wrongIds.clear();
        this.activeInteraction = null;
        this.scriptedWalk = null;
        this.seated = false;
        this.transitioning = false;
    }

    private get segment(): SegmentDefinition {
        return this.level.segments[this.segmentIndex];
    }

    create(): void {
        const account = AuthStorageService.getActiveAccount();
        if (!account) {
            this.scene.start('MainMenu');
            return;
        }

        // Kamera HD statis: zoom 2 pada backing 2560x1440, dipusatkan pada ruang
        // logis 1280x720 (resep sama dengan menu). Kamera TIDAK menggeser; world
        // yang digeser lewat worldLayer.x agar hit-test input UI tetap akurat.
        applyLogicalCamera(this);
        // Container world (di belakang UI). UI adalah objek scene biasa (depth 200+).
        this.worldLayer = this.add.container(0, 0).setDepth(0);

        const muted = SettingsStorageService.getSettings().muted;
        this.touch = new TouchControls(this, this.prefix);
        this.hud = new Hud(this, this.prefix, this.level.id, account.displayName, muted, {
            onPause: () => this.pauseGame(),
            onQuit: () => this.quitToLevelSelect(),
            onToggleMute: () => this.toggleMute(),
            onReplay: () => this.restartLevel()
        });
        this.dialog = new DialogBox(this, speakersFor(this.level.id));
        this.choicePanel = new ChoicePanel(this);
        this.pauseOverlay = new PauseOverlay(this, this.prefix);

        this.keys = this.input.keyboard!.addKeys('left,right,a,d,e,space,esc') as unknown as GameplayKeys;

        this.buildSegment();
        this.cameras.main.fadeIn(FADE_MS, 20, 6, 40);
    }

    // ---------- World / segmen ----------

    private buildSegment(): void {
        this.destroyWorld();
        const seg = this.segment;

        if (this.textures.exists(`${this.prefix}-bg`)) {
            const bg = this.add.image(0, 0, `${this.prefix}-bg`).setOrigin(0, 0).setDepth(0);
            bg.setDisplaySize(this.level.worldWidth, this.level.worldHeight);
            this.addWorld(bg);
        }

        for (const actor of seg.actors) {
            const sprite = this.add.image(actor.x, actor.y ?? this.level.groundY, `${this.prefix}-${actor.texture}`)
                .setOrigin(0.5, 1).setScale(0.5).setDepth(actor.depth ?? 6);
            if (actor.flipX) sprite.setFlipX(true);
            if (actor.hidden) sprite.setVisible(false);
            this.actorMap.set(actor.id, sprite);
            this.addWorld(sprite);
        }

        for (const obj of seg.objects) {
            const sprite = this.add.image(obj.x, obj.y, `${this.prefix}-${obj.texture}`)
                .setOrigin(0.5, obj.centered ? 0.5 : 1).setScale(0.5).setDepth(obj.depth ?? 8);
            if (obj.hidden) sprite.setVisible(false);
            this.objectMap.set(obj.id, sprite);
            this.addWorld(sprite);
        }

        this.seated = seg.spawnSeated === true;
        const playerTexture = this.seated ? this.level.player.seatedTexture : this.level.player.idleTexture;
        this.player = this.add.image(seg.spawnX, this.level.groundY, `${this.prefix}-${playerTexture}`)
            .setOrigin(0.5, 1).setScale(0.5).setDepth(7);
        this.addWorld(this.player);

        this.marker = this.add.image(0, 0, `${this.prefix}-tanda-panah`)
            .setOrigin(0.5, 1).setScale(0.6).setDepth(40).setVisible(false);
        this.addWorld(this.marker);

        // Container merender anak sesuai urutan; urutkan berdasar depth agar
        // player tertutup meja/kursi dengan benar.
        this.worldLayer.sort('depth');

        this.scrollX = this.clampScroll(seg.initialCameraX);
        this.worldLayer.setX(-this.scrollX);

        if (seg.scriptedSequence && seg.scriptedSequence.length > 0) {
            this.state = 'SCRIPTED';
            this.runScript([...seg.scriptedSequence], () => {
                this.state = 'EXPLORE';
            });
        } else {
            this.state = 'EXPLORE';
        }
    }

    /** Tambahkan objek ke container world (yang digeser saat camera-follow). */
    private addWorld(obj: GameObjects.Image): void {
        this.worldLayer.add(obj);
        this.worldObjects.push(obj);
    }

    private destroyWorld(): void {
        for (const obj of this.worldObjects) obj.destroy();
        this.worldObjects = [];
        this.actorMap.clear();
        this.objectMap.clear();
        this.marker = null;
        this.dialog?.close();
        this.choicePanel?.close();
    }

    // ---------- Scripted sequence ----------

    private runScript(steps: ScriptStep[], done: () => void): void {
        const step = steps.shift();
        if (!step) {
            done();
            return;
        }
        const next = () => this.runScript(steps, done);
        switch (step.kind) {
            case 'walk':
                this.scriptedWalk = {
                    targetX: step.targetX,
                    speed: step.speed ?? this.level.player.walkSpeed,
                    resolve: next
                };
                break;
            case 'wait':
                this.time.delayedCall(step.ms, next);
                break;
            case 'swapObject': {
                const obj = this.objectMap.get(step.objectId);
                if (obj) {
                    if (step.texture === null) obj.setVisible(false);
                    else obj.setTexture(`${this.prefix}-${step.texture}`).setScale(0.5).setVisible(true);
                }
                next();
                break;
            }
            case 'showActor':
                this.actorMap.get(step.actorId)?.setVisible(true);
                next();
                break;
            case 'dialog':
                this.state = 'DIALOG';
                this.dialog.showLines(step.lines, () => {
                    this.state = 'SCRIPTED';
                    next();
                });
                break;
            case 'dropObject': {
                const obj = this.objectMap.get(step.objectId);
                if (!obj) {
                    next();
                    break;
                }
                obj.setVisible(true).setY(step.fromY);
                this.tweens.add({
                    targets: obj, y: step.toY, duration: step.ms, ease: 'Bounce.easeOut',
                    onComplete: next
                });
                break;
            }
        }
    }

    // ---------- Target aktif & marker ----------

    private nextInteraction(): InteractionDefinition | null {
        const pending = this.segment.interactions
            .filter((i) => !this.resolvedIds.has(i.id))
            .sort((a, b) => a.order - b.order);
        return pending[0] ?? null;
    }

    private currentTarget(): { x: number; markerY: number; radius: number } | null {
        const inter = this.nextInteraction();
        if (inter) return { x: inter.triggerX, markerY: inter.markerY, radius: inter.interactionRadius };
        return { x: this.segment.exitX, markerY: 250, radius: EXIT_RADIUS };
    }

    private updateMarkerAndAction(): void {
        // Tanda panah tampil saat EXPLORE untuk mengarahkan anak: menunjuk target
        // event berikutnya, atau pintu keluar bila semua event selesai.
        const target = this.state === 'EXPLORE' ? this.currentTarget() : null;
        if (!target || !this.marker) {
            this.marker?.setVisible(false);
            this.touch.setActionEnabled(false);
            return;
        }
        const bob = Math.sin(this.time.now / 220) * 8;
        this.marker.setVisible(true).setPosition(target.x, target.markerY + bob);
        const near = Math.abs(this.player.x - target.x) <= target.radius;
        this.touch.setActionEnabled(near);
    }

    // ---------- Interaksi / dialog / pilihan ----------

    private triggerAction(): void {
        const target = this.currentTarget();
        if (!target || Math.abs(this.player.x - target.x) > target.radius) return;

        const inter = this.nextInteraction();
        if (!inter) {
            this.finishSegment();
            return;
        }
        this.startInteraction(inter);
    }

    private startInteraction(inter: InteractionDefinition): void {
        this.activeInteraction = inter;
        this.state = 'DIALOG';
        this.touch.resetHold();
        this.touch.setActionEnabled(false);
        this.marker?.setVisible(false);

        for (const swap of inter.onStartSwaps ?? []) {
            this.actorMap.get(swap.actorId)?.setTexture(`${this.prefix}-${swap.texture}`).setScale(0.5);
        }
        if (inter.sitAtX !== undefined) {
            this.sitDown(inter.sitAtX);
        }
        if (inter.collectObjectId) {
            this.objectMap.get(inter.collectObjectId)?.setVisible(false);
        }

        this.dialog.showLines(inter.dialog, () => {
            if (inter.question) {
                this.state = 'CHOICE';
                this.choicePanel.show(this.prefix, inter.question.choices, (id) => this.handleChoice(id));
            } else {
                this.resolveInteraction(inter);
            }
        });
    }

    private handleChoice(choiceId: 'A' | 'B' | 'C'): void {
        const inter = this.activeInteraction;
        if (!inter || !inter.question) return;
        const feedback = inter.question.feedback[choiceId];
        const correct = choiceId === inter.question.correctChoiceId;
        this.state = 'FEEDBACK';

        this.dialog.showLines([{ speaker: feedback.speaker, text: feedback.text }], () => {
            if (!correct) {
                // Salah: kesempatan bintang event hilang, tetap pilih ulang.
                this.wrongIds.add(inter.id);
                this.state = 'CHOICE';
                this.choicePanel.show(this.prefix, inter.question!.choices, (id) => this.handleChoice(id));
                return;
            }
            if (!this.wrongIds.has(inter.id)) {
                this.starsEarned = Math.min(3, this.starsEarned + 1);
                this.hud.setStars(this.starsEarned);
            }
            this.resolveInteraction(inter);
        });
    }

    private resolveInteraction(inter: InteractionDefinition): void {
        for (const swap of inter.onResolveSwaps ?? []) {
            this.actorMap.get(swap.actorId)?.setTexture(`${this.prefix}-${swap.texture}`).setScale(0.5);
        }
        for (const id of inter.onResolveHideObjects ?? []) {
            this.objectMap.get(id)?.setVisible(false);
        }
        for (const id of inter.onResolveShowObjects ?? []) {
            this.objectMap.get(id)?.setVisible(true);
        }
        if (this.seated) this.standUp();
        this.resolvedIds.add(inter.id);
        this.activeInteraction = null;
        this.state = 'EXPLORE';
    }

    private sitDown(x: number): void {
        this.seated = true;
        this.player.setX(x);
        this.player.setTexture(`${this.prefix}-${this.level.player.seatedTexture}`).setScale(0.5);
    }

    private standUp(): void {
        this.seated = false;
        this.player.setTexture(`${this.prefix}-${this.level.player.idleTexture}`).setScale(0.5);
    }

    private finishSegment(): void {
        if (this.transitioning) return;
        this.transitioning = true;
        this.state = 'SEGMENT_EXIT';
        this.touch.resetHold();
        this.cameras.main.fadeOut(FADE_MS, 20, 6, 40);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.transitioning = false;
            this.segmentIndex += 1;
            if (this.segmentIndex >= this.level.segments.length) {
                this.completeLevel();
                return;
            }
            this.buildSegment();
            this.cameras.main.fadeIn(FADE_MS, 20, 6, 40);
        });
    }

    private completeLevel(): void {
        this.state = 'COMPLETE';
        const account = AuthStorageService.getActiveAccount();
        if (account) {
            ProgressStorageService.recordLevelResult(account.id, this.level.id, this.starsEarned);
        }
        this.scene.start('Result', { levelId: this.level.id, runStars: this.starsEarned });
    }

    // ---------- Pause / quit / mute / replay ----------

    private pauseGame(): void {
        if (this.state === 'PAUSED' || this.transitioning) return;
        this.stateBeforePause = this.state;
        this.state = 'PAUSED';
        this.touch.resetHold();
        this.tweens.pauseAll();
        this.time.paused = true;
        this.pauseOverlay.show(SettingsStorageService.getSettings().muted, {
            onResume: () => this.resumeGame(),
            onReplay: () => this.restartLevel(),
            onQuit: () => this.quitToLevelSelect(),
            onToggleMute: () => this.toggleMute()
        });
    }

    private resumeGame(): void {
        if (this.state !== 'PAUSED') return;
        this.pauseOverlay.hide();
        this.tweens.resumeAll();
        this.time.paused = false;
        this.state = this.stateBeforePause;
    }

    private restartLevel(): void {
        this.pauseOverlay.hide();
        this.tweens.resumeAll();
        this.time.paused = false;
        this.scene.restart({ levelId: this.level.id });
    }

    private quitToLevelSelect(): void {
        this.pauseOverlay.hide();
        this.tweens.resumeAll();
        this.time.paused = false;
        this.scene.start('LevelSelect');
    }

    private toggleMute(): void {
        const muted = !SettingsStorageService.getSettings().muted;
        SettingsStorageService.setMuted(muted);
        this.hud.setMuted(muted);
        this.pauseOverlay.setMuted(muted);
    }

    // ---------- Update loop ----------

    update(_time: number, delta: number): void {
        if (!this.player) return;

        if (Input.Keyboard.JustDown(this.keys.esc)) {
            if (this.state === 'PAUSED') this.resumeGame();
            else this.pauseGame();
        }
        if (this.state === 'PAUSED' || this.state === 'COMPLETE') return;

        const actionJust = Input.Keyboard.JustDown(this.keys.e)
            || Input.Keyboard.JustDown(this.keys.space)
            || this.touch.consumeAction();

        if (this.state === 'DIALOG' || this.state === 'FEEDBACK') {
            if (actionJust) this.dialog.advance();
            return;
        }
        if (this.state === 'CHOICE') return;

        if (this.state === 'SCRIPTED') {
            this.updateScriptedWalk(delta);
            this.followCamera();
            return;
        }

        // EXPLORE
        const left = this.keys.left.isDown || this.keys.a.isDown || this.touch.leftDown;
        const right = this.keys.right.isDown || this.keys.d.isDown || this.touch.rightDown;
        if (!this.seated && left !== right) {
            const dir = right ? 1 : -1;
            const nx = this.player.x + dir * this.level.player.walkSpeed * (delta / 1000);
            this.player.setX(Math.round(
                Math.max(this.segment.minPlayerX, Math.min(this.segment.maxPlayerX, nx))
            ));
            this.animateWalk(delta, dir);
        } else {
            this.setIdleFrame();
        }

        this.updateMarkerAndAction();
        if (actionJust) this.triggerAction();
        this.followCamera();
    }

    private updateScriptedWalk(delta: number): void {
        const walk = this.scriptedWalk;
        if (!walk) return;
        const dx = walk.targetX - this.player.x;
        const stepDist = walk.speed * (delta / 1000);
        if (Math.abs(dx) <= stepDist) {
            this.player.setX(walk.targetX);
            this.setIdleFrame();
            this.scriptedWalk = null;
            walk.resolve();
            return;
        }
        const dir = dx > 0 ? 1 : -1;
        this.player.setX(this.player.x + dir * stepDist);
        this.animateWalk(delta, dir);
    }

    private animateWalk(delta: number, dir: 1 | -1): void {
        this.walkTimer += delta;
        const frameMs = 1000 / this.level.player.animFps;
        if (this.walkTimer >= frameMs) {
            this.walkTimer = 0;
            this.walkFrame = (this.walkFrame + 1) % 4;
        }
        const frames = dir === 1
            ? this.level.player.walkRightTextures
            : this.level.player.walkLeftTextures;
        const key = `${this.prefix}-${frames[this.walkFrame]}`;
        if (this.player.texture.key !== key) {
            this.player.setTexture(key).setScale(0.5);
        }
    }

    private setIdleFrame(): void {
        if (this.seated) return;
        const key = `${this.prefix}-${this.level.player.idleTexture}`;
        if (this.player.texture.key !== key) {
            this.player.setTexture(key).setScale(0.5);
            this.walkFrame = 0;
            this.walkTimer = 0;
        }
    }

    private clampScroll(value: number): number {
        const maxScroll = this.level.worldWidth - VIEWPORT_W;
        return Math.max(0, Math.min(maxScroll, value));
    }

    private followCamera(): void {
        const target = this.clampScroll(this.player.x - VIEWPORT_W / 2);
        const next = this.scrollX + (target - this.scrollX) * CAMERA_LERP;
        // Bulatkan ke 0.5 logis = integer pixel backing (zoom 2) — anti jitter.
        this.scrollX = Math.round(next * 2) / 2;
        this.worldLayer.setX(-this.scrollX);
    }
}
