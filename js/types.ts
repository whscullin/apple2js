
/** A byte (0..255). This is not enforced by the compiler. */
export type byte = number;

/** A word (0..65535). This is not enforced by the compiler. */
export type word = number;

export type DiskFormat = '2mg' | 'd13' | 'do' | 'dsk' | 'hdv' | 'po' | 'nib' | 'woz';

export interface Drive {
  format: DiskFormat,
  volume: number,
  tracks: Array<byte[] | Uint8Array>,
  trackMap: unknown,
};

export interface DiskIIDrive extends Drive {
  rawTracks: unknown,
  track: number,
  head: number,
  phase: number,
  readOnly: boolean,
  dirty: boolean,
};
