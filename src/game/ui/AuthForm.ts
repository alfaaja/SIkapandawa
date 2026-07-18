import { Scene, GameObjects } from 'phaser';

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
 * Kumpulan input DOM untuk form Register/Login.
 * Input diposisikan di atas sprite textbox dan dibersihkan saat scene shutdown.
 */
export class AuthForm {
    private readonly elements: GameObjects.DOMElement[] = [];
    private readonly inputs = new Map<string, HTMLInputElement>();
    private readonly onSubmit: () => void;
    private enabled = true;

    constructor(scene: Scene, fields: AuthFieldSpec[], onSubmit: () => void) {
        this.onSubmit = onSubmit;

        for (const field of fields) {
            const input = document.createElement('input');
            input.type = field.type;
            input.name = field.id;
            input.maxLength = field.maxLength;
            input.autocomplete = 'off';
            input.spellcheck = false;
            input.style.width = `${field.width}px`;
            input.style.height = `${field.height}px`;
            input.style.border = 'none';
            input.style.outline = 'none';
            input.style.background = 'transparent';
            input.style.color = '#3a0a52';
            input.style.fontFamily = '"Courier New", Courier, monospace';
            input.style.fontWeight = 'bold';
            input.style.fontSize = '20px';
            input.style.padding = '0 6px';
            input.style.borderRadius = '10px';
            input.style.boxSizing = 'border-box';

            // Focus state yang terlihat tanpa merusak visual textbox.
            input.addEventListener('focus', () => {
                input.style.boxShadow = 'inset 0 0 0 3px #9441c0';
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

            const element = scene.add.dom(field.x, field.y, input);
            this.elements.push(element);
            this.inputs.set(field.id, input);
        }

        // Pastikan tidak ada DOM tertinggal saat scene ditutup.
        scene.events.once('shutdown', () => this.destroy());
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

    /** Sembunyikan input saat modal tampil agar DOM tidak melayang di atas modal. */
    setVisible(visible: boolean): void {
        for (const element of this.elements) {
            element.setVisible(visible);
        }
    }

    destroy(): void {
        for (const element of this.elements) {
            element.destroy();
        }
        this.elements.length = 0;
        this.inputs.clear();
    }
}
