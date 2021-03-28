
/**
 * Extracts the members of a constant array as a type. Used as:
 *
 * @example
 * const SOME_VALUES = ['a', 'b', 1, 2] as const;
 * type SomeValues = MemberOf<typeof SOME_VALUES>; // 'a' | 'b' | 1 | 2
 */
export type MemberOf<T extends ReadonlyArray<unknown>> =
    T extends ReadonlyArray<infer E> ? E : never;

/**
 * Recursively extracts all members of a constant array as a type. Used as:
 * 
 * @example
 * const SOME_ARRAYS = [['a'],['b', 2], 3] as const;
 * type SomeArrayValues = DeepMemberOf<typeof SOME_ARRAYS>; // 'a' | 'b' | 2 | 3
 */
export type DeepMemberOf<T extends ReadonlyArray<unknown>> =
    T extends ReadonlyArray<infer E>
    ? (E extends ReadonlyArray<unknown> ? DeepMemberOf<E> : E)
    : never;

/**
 * Extracts the declared keys of a type by removing `string` and `number`.
 * 
 * Cribbed from the interwebs:
 * https://github.com/microsoft/TypeScript/issues/25987#issuecomment-408339599
 */
export type KnownKeys<T> = {
    [K in keyof T]: string extends K ? never : number extends K ? never : K
} extends { [_ in keyof T]: infer U } ? U : never;


/** A bit. */
export type bit = 0 | 1;

/** A nibble. */
export type nibble =
    0x0 | 0x1 | 0x2 | 0x3 | 0x4 | 0x5 | 0x6 | 0x7 |
    0x8 | 0x9 | 0xa | 0xb | 0xc | 0xd | 0xe | 0xf;

/** A byte (0..255). This is not enforced by the compiler. */
export type byte = number;

/** A word (0..65535). This is not enforced by the compiler. */
export type word = number;

/** A raw region of memory. */
export type memory = Uint8Array;

/** A raw region of memory. */
export type rom = ReadonlyUint8Array;

export interface Memory {
    /** Read a byte. */
    read(page: byte, offset: byte): byte;
    /** Write a byte. */
    write(page: byte, offset: byte, value: byte): void;
}

/** A mapped region of memory. */
export interface MemoryPages extends Memory {
    /** Start page. */
    start(): byte;
    /** End page, inclusive. */
    end(): byte;
}

/* An interface card */
export interface Card extends Memory, Restorable {
    /* Reset the card */
    reset?(): void;

    /* Draw card to canvas */
    blit?(): ImageData | undefined;

    /* Process period events */
    tick?(): void;

    /* Read or Write an I/O switch */
    ioSwitch(off: byte, val?: byte): byte | undefined;
}

export const DISK_FORMATS = [
    '2mg',
    'd13',
    'do',
    'dsk',
    'hdv',
    'po',
    'nib',
    'woz'
] as const;

export type DiskFormat = MemberOf<typeof DISK_FORMATS>;

export interface Drive {
    format: DiskFormat,
    volume: number,
    tracks: Array<byte[] | Uint8Array>,
    trackMap: unknown,
}

export interface DiskIIDrive extends Drive {
    rawTracks: unknown,
    track: number,
    head: number,
    phase: number,
    readOnly: boolean,
    dirty: boolean,
}

export type TapeData = Array<[duration: number, high: boolean]>;

export interface Restorable<T = any> {
    getState(): T;
    setState(state: T): void;
}

// Read-only typed arrays for constants
export type TypedArrayMutableProperties = 'copyWithin' | 'fill' | 'reverse' | 'set' | 'sort';
export interface ReadonlyUint8Array extends Omit<Uint8Array, TypedArrayMutableProperties> {
    readonly [n: number]: number
}

// Readonly RGB color value
export type Color = readonly [r: byte, g: byte, b: byte];
