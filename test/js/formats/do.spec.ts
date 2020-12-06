import DOS from '../../../js/formats/do';
import { memory } from '../../../js/types';
import { BYTES_IN_ORDER, BYTES_BY_TRACK } from './testdata/16sector';

function skipGap(track: memory, start: number = 0): number {
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

function compareSequences(track: memory, bytes: number[], pos: number): boolean {
    for (let i = 0; i < bytes.length; i++) {
        if (track[i + pos] != bytes[i]) {
            return false;
        }
    }
    return true;
}

function findBytes(track: memory, bytes: number[], start: number = 0): number {
    for (let i = start; i < track.length; i++) {
        if (compareSequences(track, bytes, i)) {
            return i + bytes.length;
        }
    }
    return -1;
}

describe('compareSequences', () => {
    it('matches at pos 0', () => {
        expect(compareSequences([0x01, 0x02, 0x03], [0x01, 0x02, 0x03], 0)).toBeTruthy();
    });

});

describe('DOS format', () => {
    it('is constructable', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_IN_ORDER,
            volume: 10,
            readOnly: true,
        });
        expect(disk).not.toBeNull();
    });

    it('has correct number of tracks', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        expect(disk.tracks.length).toEqual(35);
    });

    it('has correct number of bytes in track 0', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        expect(disk.tracks[0].length).toEqual(6632);
    });

    it('has correct number of bytes in all tracks', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        // Track 0 is slightly longer for some reason.
        expect(disk.tracks[0].length).toEqual(6632);
        for (let i = 1; i < disk.tracks.length; i++) {
            expect(disk.tracks[i].length).toEqual(6602);
        }
    });

    it('has correct GAP 1', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        // From Beneith Apple DOS, GAP 1 should have 12-85 0xFF bytes
        let numFF = 0;
        while (disk.tracks[0][numFF] == 0xFF && numFF < 0x100) {
            numFF++;
        }
        expect(numFF).toBeGreaterThanOrEqual(12);
        expect(numFF).toBeLessThanOrEqual(85);
    });

    it('has correct Address Field for sector 0', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        let i = skipGap(disk.tracks[0]);
        // prologue
        expect(disk.tracks[0][i++]).toBe(0xD5);
        expect(disk.tracks[0][i++]).toBe(0xAA);
        expect(disk.tracks[0][i++]).toBe(0x96);
        // volume 10 = 0b00001010
        expect(disk.tracks[0][i++]).toBe(0b10101111);
        expect(disk.tracks[0][i++]).toBe(0b10101010);
        // track 0 = 0b00000000
        expect(disk.tracks[0][i++]).toBe(0b10101010);
        expect(disk.tracks[0][i++]).toBe(0b10101010);
        // sector 15 = 0b00001111
        expect(disk.tracks[0][i++]).toBe(0b10101111);
        expect(disk.tracks[0][i++]).toBe(0b10101111);
        // checksum = 0b00000101
        expect(disk.tracks[0][i++]).toBe(0b10101010);
        expect(disk.tracks[0][i++]).toBe(0b10101111);
        // epilogue
        expect(disk.tracks[0][i++]).toBe(0xDE);
        expect(disk.tracks[0][i++]).toBe(0xAA);
        expect(disk.tracks[0][i++]).toBe(0xEB);
    });

    it('has correct Data Field for sector 0', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const m: memory = disk.tracks[0];
        let i = findBytes(disk.tracks[0], [0xDE, 0xAA, 0xEB]);
        expect(i).toBeGreaterThan(50);
        i = skipGap(m, i);
        // prologue
        expect(m[i++]).toBe(0xD5);
        expect(m[i++]).toBe(0xAA);
        expect(m[i++]).toBe(0xAD);
        // data (all zeros, which is 96 with 6 and 2 encoding)
        for (let j = 0; j < 342; j++) {
            expect(m[i++]).toBe(0x96);
        }
        // checksum (also zero)
        expect(m[i++]).toBe(0x96);
        // epilogue
        expect(disk.tracks[0][i++]).toBe(0xDE);
        expect(disk.tracks[0][i++]).toBe(0xAA);
        expect(disk.tracks[0][i++]).toBe(0xF2); // should be EB?
    });
});