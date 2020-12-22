import DOS from '../../../js/formats/do';
import { memory } from '../../../js/types';
import { BYTES_BY_TRACK } from './testdata/16sector';

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

function expectSequence(track: memory, pos: number, bytes: number[]): number {
    if (!compareSequences(track, bytes, pos)) {
        const track_slice = track.slice(pos, Math.min(track.length, pos + bytes.length));
        fail(`expected ${bytes} got ${track_slice}`);
    }
    return pos + bytes.length;
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
        expect(
            compareSequences([0x01, 0x02, 0x03], [0x01, 0x02, 0x03], 0)
        ).toBeTruthy();
    });

    it('matches at pos 1', () => {
        expect(
            compareSequences([0x00, 0x01, 0x02, 0x03], [0x01, 0x02, 0x03], 1)
        ).toBeTruthy();
    });
});

describe('DOS format', () => {
    it('is callable', () => {
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
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
        const track = disk.tracks[0];
        let numFF = 0;
        while (track[numFF] == 0xFF && numFF < 0x100) {
            numFF++;
        }
        expect(numFF).toBeGreaterThanOrEqual(40);
        expect(numFF).toBeLessThanOrEqual(128);
    });

    it('has correct Address Field for track 0, sector 0', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track = disk.tracks[0];
        let i = skipGap(track);
        // prologue
        i = expectSequence(track, i, [0xD5, 0xAA, 0x96]);
        // volume 10 = 0b00001010
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101010);
        // track 0 = 0b00000000
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101010);
        // sector 0 = 0b00000000
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101010);
        // checksum = 0b00000101
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101010);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Data Field for track 0, sector 0 (BYTES_BY_TRACK)', () => {
        // _Beneath Apple DOS_, DATA FIELD ENCODING, pp. 3-13 to 3-21
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track: memory = disk.tracks[0];
        // skip to the first address epilogue
        let i = findBytes(track, [0xDE, 0xAA, 0xEB]);
        expect(i).toBeGreaterThan(50);
        i = skipGap(track, i);
        // prologue
        i = expectSequence(track, i, [0xD5, 0xAA, 0xAD]);
        // data (all zeros, which is 0x96 with 6 and 2 encoding)
        for (let j = 0; j < 342; j++) {
            expect(track[i++]).toBe(0x96);
        }
        // checksum (also zero)
        expect(track[i++]).toBe(0x96);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Address Field for track 0, sector 1', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track = disk.tracks[0];
        // first sector prologue
        let i = findBytes(track, [0xD5, 0xAA, 0x96]);

        // second sector prologue
        i = findBytes(track, [0xD5, 0xAA, 0x96], i);
        // volume 10 = 0b00001010
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101010);
        // track 0 = 0b00000000
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101010);
        // sector 1 = 0b00000001
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101011);
        // checksum = 0b00000101
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101011);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Address Field for track 1, sector 0', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track = disk.tracks[1];
        let i = skipGap(track);
        // prologue
        i = expectSequence(track, i, [0xD5, 0xAA, 0x96]);
        // volume 10 = 0b00001010
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101010);
        // track 1 = 0b00000001
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101011);
        // sector 0 = 0b00000000
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101010);
        // checksum = 0b00000100
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101011);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Data Field for track 1, sector 0 (BYTES_BY_TRACK)', () => {
        // _Beneath Apple DOS_, DATA FIELD ENCODING, pp. 3-13 to 3-21
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track: memory = disk.tracks[1];
        let i = findBytes(track, [0xDE, 0xAA, 0xEB]);
        expect(i).toBeGreaterThan(50);
        i = skipGap(track, i);
        // prologue
        i = expectSequence(track, i, [0xD5, 0xAA, 0xAD]);
        // In 6 x 2 encoding, the lowest 2 bits of all the bytes come first.
        // This would normally mean 86 instances of 0b101010 (2A -> 0xE6),
        // but each byte is XOR'd with the previous. Since all of the bits
        // are the same, this means there are 85 0b000000 (00 -> 0x96).
        expect(track[i++]).toBe(0xE6);
        for (let j = 0; j < 85; j++) {
            expect(track[i++]).toBe(0x96);
        }
        // Next we get 256 instances of the top bits, 0b000000. Again, with
        // the XOR, this means one 0x101010 (2A -> 0xE6) followed by 255
        // 0b0000000 (00 -> 0x96).
        expect(track[i++]).toBe(0xE6);
        for (let j = 0; j < 255; j++) {
            expect(track[i++]).toBe(0x96);
        }
        // checksum (also zero)
        expect(track[i++]).toBe(0x96);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });
});