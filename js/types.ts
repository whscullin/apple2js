
/**
 * Extracts the members of a constant array as a type. Used as:
 * 
 * @example
 * const SOME_VALUES = ['a', 'b', 1, 2] as const;
 * type SomeValues = MemberOf<typeof SOME_VALUES>; // 'a' | 'b' | 1 | 2
 */
export type MemberOf<T extends ReadonlyArray<unknown>> =
  T extends ReadonlyArray<infer E> ? E : never;

/** A byte (0..255). This is not enforced by the compiler. */
export type byte = number;

/** A word (0..65535). This is not enforced by the compiler. */
export type word = number;

/** A raw region of memory. */
export type memory = number[] | Uint8Array;

/** A mapped region of memory. */
export interface Memory {
  /** Start page. */
  start(): byte;
  /** End page, inclusive. */
  end(): byte;
  /** Read a byte. */
  read(page: byte, offset: byte): byte;
  /** Write a byte. */
  write(page: byte, offset: byte, value: byte): void;
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

export interface Restorable<T> {
  getState(): T;
  setState(state: T): void;
}