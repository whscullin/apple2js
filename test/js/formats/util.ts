import { memory } from 'js/types';

export function skipGap(track: memory, start: number = 0): number {
    const end = start + 0x100; // no gap is this big
    let i = start;
    while (i < end && track[i] == 0xFF) {
        i++;
    }
    if (i == end) {
        fail(`found more than 0x100 0xFF bytes after ${start}`);
    }
    return i;
}

export function compareSequences(track: memory, bytes: number[], pos: number): boolean {
    for (let i = 0; i < bytes.length; i++) {
        if (track[i + pos] != bytes[i]) {
            return false;
        }
    }
    return true;
}

export function expectSequence(track: memory, pos: number, bytes: number[]): number {
    if (!compareSequences(track, bytes, pos)) {
        const track_slice = track.slice(pos, Math.min(track.length, pos + bytes.length));
        fail(`expected ${bytes} got ${track_slice}`);
    }
    return pos + bytes.length;
}

export function findBytes(track: memory, bytes: number[], start: number = 0): number {
    if (start + bytes.length > track.length) {
        return -1;
    }
    for (let i = start; i < track.length; i++) {
        if (compareSequences(track, bytes, i)) {
            return i + bytes.length;
        }
    }
    return -1;
}

export const stringToBytes = (val: string, pad: string = '\0', padLength: number = 0) => {
    const result = [];
    let idx = 0;
    while (idx < val.length) {
        result.push(val.charCodeAt(idx) & 0xff);
        idx++;
    }
    while (idx++ < padLength) {
        result.push(pad.charCodeAt(0));
    }
    return result;
};

export const numberToBytes = (val: number, count: number) => {
    const result = [];
    let idx = 0;
    while (idx < count) {
        result.push(val & 0xff);
        val >>= 8;
        idx++;
    }
    return result;
};
