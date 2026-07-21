import { Scene } from 'phaser';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './backdrop';

export interface AuthFieldSpec {
    id: string;
    type: 'text' | 'password';
    /** Pusat field dalam koordinat desain 1280x720. */
    x: number;
    y: number;
    width: number;
    height: number;
    maxLength: number;
}

/**
 * Input form Register/Login sebagai overlay HTML absolut di atas canvas.
 *
 * Tidak memakai Phaser DOMElement karena kamera ber-zoom membuat posisi
 * DOMElement meleset (container DOM hanya menerima skala FIT, bukan zoom
 * kamera). Di sini posisi dihitung langsung dari rect canvas + koordinat
 * logis sehingga selalu sejajar dengan sprite textbox pada skala berapa pun.
 */
export class AuthForm {
    private readonly scene: Scene;
    private readonly fields: AuthFieldSpec[];
    private readonly wrapper: HTMLDivElement;
    private readonly inputs = new Map<string, HTMLInputElement>();
    private readonly onSubmit: () => void;
    private readonly onResize = () => this.reposition();
    private enabled = true;

    constructor(scene: Scene, fields: AuthFieldSpec[], onSubmit: () => void) {
        this.scene = scene;
        this.fields = fields;
        this.onSubmit = onSubmit;

        this.wrapper = document.createElement('div');
        this.wrapper.style.position = 'fixed';
        this.wrapper.style.left = '0';
        this.wrapper.style.top = '0';
        this.wrapper.style.pointerEvents = 'none';
        this.wrapper.style.zIndex = '10';
        document.body.appendChild(this.wrapper);

        for (const field of fields) {
            const input = document.createElement('input');
            input.type = field.type;
            input.name = field.id;
            input.maxLength = field.maxLength;
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.style.position = 'fixed';
            input.style.margin = '0';
            input.style.border = 'none';
            input.style.outline = 'none';
            input.style.background = 'transparent';
            input.style.color = '#3a0a52';
            input.style.fontFamily = '"Press Start 2P", "Courier New", monospace';
            input.style.fontWeight = 'normal';
            input.style.boxSizing = 'border-box';
            input.style.pointerEvents = 'auto';

            input.addEventListener('focus', () => {
                input.style.boxShadow = 'inset 0 0 0 2px #9441c0';
            });
            input.addEventListener('blur', () => {
                input.style.boxShadow = 'none';
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && this.enabled) {
                    event.preventDefault();
                    this.onSubmit();
                }
            });

            this.wrapper.appendChild(input);
            this.inputs.set(field.id, input);
        }

        this.reposition();
        window.addEventListener('resize', this.onResize);
        this.scene.scale.on('resize', this.onResize);
        // Reposisi sekali lagi setelah frame pertama (setelah kanvas final di-layout).
        this.scene.time.delayedCall(60, this.onResize);

        scene.events.once('shutdown', () => this.destroy());
        scene.events.once('destroy', () => this.destroy());
    }

    /** Hitung posisi CSS tiap input dari rect canvas + koordinat logis. */
    private reposition(): void {
        const canvas = this.scene.game.canvas;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const sx = rect.width / DESIGN_WIDTH;
        const sy = rect.height / DESIGN_HEIGHT;

        for (const field of this.fields) {
            const input = this.inputs.get(field.id);
            if (!input) continue;
            const w = field.width * sx;
            const h = field.height * sy;
            input.style.width = `${w}px`;
            input.style.height = `${h}px`;
            input.style.left = `${rect.left + field.x * sx - w / 2}px`;
            input.style.top = `${rect.top + field.y * sy - h / 2}px`;
            input.style.fontSize = `${Math.max(9, Math.round(13 * sy))}px`;
            input.style.paddingLeft = `${Math.round(8 * sx)}px`;
        }
    }

    value(id: string): string {
        return this.inputs.get(id)?.value ?? '';
    }

    focusFirst(): void {
        const first = this.inputs.values().next().value;
        if (first) first.focus();
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        for (const input of this.inputs.values()) {
            input.disabled = !enabled;
        }
    }

    /** Sembunyikan input saat modal tampil agar tidak melayang di atas modal. */
    setVisible(visible: boolean): void {
        this.wrapper.style.display = visible ? 'block' : 'none';
    }

    destroy(): void {
        window.removeEventListener('resize', this.onResize);
        this.scene.scale.off('resize', this.onResize);
        this.wrapper.remove();
        this.inputs.clear();
    }
}
