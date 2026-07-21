/** Tipe data gameplay Level 1–2 (data-driven, satu Gameplay scene generik). */

export type GameplayState =
    | 'SCRIPTED'
    | 'EXPLORE'
    | 'DIALOG'
    | 'CHOICE'
    | 'FEEDBACK'
    | 'SEGMENT_EXIT'
    | 'PAUSED'
    | 'COMPLETE';

export interface DialogLine {
    /** Kunci pembicara → memilih textbox + nama (mis. 'pak-guru', 'budi'). */
    speaker: string;
    text: string;
}

export interface ChoiceOption {
    id: 'A' | 'B' | 'C';
    text: string;
}

export interface FeedbackEntry {
    speaker: string;
    correct: boolean;
    text: string;
}

export interface QuestionDefinition {
    choices: ChoiceOption[];
    correctChoiceId: 'A' | 'B' | 'C';
    feedback: Record<'A' | 'B' | 'C', FeedbackEntry>;
}

/** Pose aktor memakai key texture tanpa prefix level (mis. 'budi-duduk'). */
export interface ActorPlacement {
    id: string;
    texture: string;
    x: number;
    /** Kaki aktor (origin 0.5,1). Default ground 560. */
    y?: number;
    depth?: number;
    flipX?: boolean;
    /** Aktor belum tampil saat segmen mulai (mis. Pak Guru sebelum masuk). */
    hidden?: boolean;
}

export interface ObjectPlacement {
    id: string;
    texture: string;
    x: number;
    y: number;
    /** Origin default (0.5,1) — objek berdiri di lantai; (0.5,0.5) bila floating. */
    centered?: boolean;
    depth?: number;
    hidden?: boolean;
}

export type ScriptStep =
    | { kind: 'walk'; targetX: number; speed?: number }
    | { kind: 'swapObject'; objectId: string; texture: string | null }
    | { kind: 'showActor'; actorId: string }
    | { kind: 'wait'; ms: number }
    | { kind: 'dialog'; lines: DialogLine[] }
    | { kind: 'dropObject'; objectId: string; fromY: number; toY: number; ms: number };

/** Perubahan aktor/objek ketika interaksi dimulai atau selesai. */
export interface ActorSwap {
    actorId: string;
    texture: string;
}

export interface InteractionDefinition {
    id: string;
    order: number;
    /** Posisi X target di world; marker tanda panah muncul di atasnya. */
    triggerX: number;
    /** Y ujung atas target untuk penempatan marker (world). */
    markerY: number;
    interactionRadius: number;
    /** Pemain duduk pada interaksi ini (kursi). */
    sitAtX?: number;
    /** Objek yang disembunyikan saat aksi (mis. koin diambil). */
    collectObjectId?: string;
    onStartSwaps?: ActorSwap[];
    onResolveSwaps?: ActorSwap[];
    /** Objek dihapus/dipulihkan saat resolve (vas dibersihkan). */
    onResolveHideObjects?: string[];
    onResolveShowObjects?: string[];
    dialog: DialogLine[];
    /** Tanpa question = interaksi naratif (mis. gabung barisan, ambil koin). */
    question?: QuestionDefinition;
}

export interface SegmentDefinition {
    id: string;
    order: number;
    title: string;
    spawnX: number;
    /** Pemain mulai dalam keadaan duduk (L1-S3). */
    spawnSeated?: boolean;
    initialCameraX: number;
    minPlayerX: number;
    maxPlayerX: number;
    actors: ActorPlacement[];
    objects: ObjectPlacement[];
    scriptedSequence?: ScriptStep[];
    interactions: InteractionDefinition[];
    exitX: number;
}

export interface PlayerDefinition {
    idleTexture: string;
    seatedTexture: string;
    walkRightTextures: string[];
    walkLeftTextures: string[];
    walkSpeed: number;
    animFps: number;
}

export interface LevelDefinition {
    id: number;
    title: string;
    subtitle: string;
    /** Prefix asset: 'lv1' | 'lv2'. */
    assetPrefix: string;
    worldWidth: number;
    worldHeight: number;
    groundY: number;
    player: PlayerDefinition;
    segments: SegmentDefinition[];
    conclusionTitle: string;
    conclusion: string;
    introCharacterId?: string;
}

/** Nama tampilan pembicara + key textbox per level. */
export interface SpeakerStyle {
    displayName: string;
    textboxTexture: string;
}
