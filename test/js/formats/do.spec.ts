import DOS from 'js/formats/do';
import { memory } from 'js/types';
import { BYTES_BY_SECTOR, BYTES_BY_TRACK } from './testdata/16sector';
import { expectSequence, findBytes, skipGap } from './util';

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

    it('has correct Data Field for track 0, sector 1 (BYTES_BY_SECTOR)', () => {
        // _Beneath Apple DOS_, DATA FIELD ENCODING, pp. 3-13 to 3-21
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_SECTOR,
            volume: 10,
            readOnly: true,
        });
        const track: memory = disk.tracks[0];
        // First data field prologue
        let i = findBytes(track, [0xD5, 0xAA, 0xAD]);
        // Second data field prologue
        i = findBytes(track, [0xD5, 0xAA, 0xAD], i);
        // Sector 1 is DOS sector 7.
        // In 6 x 2 encoding, the lowest 2 bits of all the bytes come first.
        // 0x07 is 0b00000111, so the lowest two bits are 0b11, reversed and
        // repeated would be 0b111111 (3F -> 0xFF), but since each byte is
        // XOR'd with the previous, this means there are 85 0b00000000 (00 ->
        // 0x96) bytes.
        expect(track[i++]).toBe(0xFF);
        for (let j = 0; j < 85; j++) {
            expect(track[i++]).toBe(0x96);
        }
        // Next we get 256 instances of the top bits, 0b000001. Again, with
        // the XOR, this means one 0b000001 XOR 0b111111 = 0b111110
        // (3E -> 0xFE) followed by 255 0b0000000 (00 -> 0x96).
        expect(track[i++]).toBe(0xFE);
        for (let j = 0; j < 255; j++) {
            expect(track[i++]).toBe(0x96);
        }
        // checksum
        expect(track[i++]).toBe(0x97);
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

    it('has correct Address Fields for all tracks', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });

        for (let t = 0; t < disk.tracks.length; t++) {
            // We essentially seek through the track for the Address Fields
            const track = disk.tracks[t];
            let i = findBytes(track, [0xD5, 0xAA, 0x96]);
            for (let s = 0; s <= 15; s++) {
                // volume 10 = 0b00001010
                expect(track[i++]).toBe(0b10101111);
                expect(track[i++]).toBe(0b10101010);
                // convert track to 4x4 encoding
                const track4x4XX = ((t & 0b10101010) >> 1) | 0b10101010;
                const track4x4YY = (t & 0b01010101) | 0b10101010;
                expect(track[i++]).toBe(track4x4XX);
                expect(track[i++]).toBe(track4x4YY);
                // convert sector to 4x4 encoding
                const sector4x4XX = ((s & 0b10101010) >> 1) | 0b10101010;
                const sector4x4YY = (s & 0b01010101) | 0b10101010;
                expect(track[i++]).toBe(sector4x4XX);
                expect(track[i++]).toBe(sector4x4YY);
                // checksum
                expect(track[i++]).toBe(0b10101111 ^ track4x4XX ^ sector4x4XX);
                expect(track[i++]).toBe(0b10101010 ^ track4x4YY ^ sector4x4YY);
                // epilogue
                i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
                // next sector
                i = findBytes(track, [0xD5, 0xAA, 0x96], i);
            }
        }
    });
});
