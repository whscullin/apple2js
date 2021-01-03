import DOS13 from '../../../js/formats/d13';
import { D13O } from '../../../js/formats/format_utils';
import { memory } from '../../../js/types';
import { BYTES_BY_SECTOR, BYTES_BY_TRACK } from './testdata/13sector';
import { expectSequence, findBytes, skipGap } from './util';

describe('DOS-13 format', () => {
    it('is callable', () => {
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        expect(disk).not.toBeNull();
    });

    it('has correct number of tracks', () => {
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        expect(disk.tracks.length).toEqual(35);
    });

    it('has correct number of bytes in track 0', () => {
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        expect(disk.tracks[0].length).toEqual(6289);
    });

    it('has correct number of bytes in all tracks', () => {
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        // Track 0 is slightly longer for some reason.
        expect(disk.tracks[0].length).toEqual(6289);
        for (let i = 1; i < disk.tracks.length; i++) {
            expect(disk.tracks[i].length).toEqual(6265);
        }
    });

    it('has correct GAP 1', () => {
        const disk = DOS13({
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
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track = disk.tracks[0];
        let i = skipGap(track);
        // prologue
        i = expectSequence(track, i, [0xD5, 0xAA, 0xB5]);
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
        const disk = DOS13({
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
        // data (all zeros, which is 0xAB with 5 and 3 encoding)
        for (let j = 0; j < 410; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        // checksum (also zero)
        expect(track[i++]).toBe(0xAB);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Address Field for track 0, sector 1', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track = disk.tracks[0];
        // first sector prologue
        let i = findBytes(track, [0xD5, 0xAA, 0xB5]);

        // second sector prologue
        i = findBytes(track, [0xD5, 0xAA, 0xB5], i);
        // volume 10 = 0b00001010
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101010);
        // track 0 = 0b00000000
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101010);
        // sector A = 0b00001010
        expect(track[i++]).toBe(0b10101111);
        expect(track[i++]).toBe(0b10101010);
        // checksum = 0b00000101
        expect(track[i++]).toBe(0b10101010);
        expect(track[i++]).toBe(0b10101010);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Data Field for track 0, disk sector 1 (BYTES_BY_SECTOR)', () => {
        // _Beneath Apple DOS_, DATA FIELD ENCODING, pp. 3-13 to 3-21
        const disk = DOS13({
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

        // Sector 1 is physical/DOS sector A.
        // In 5 x 3 encoding, the lowest 3 bits of all the bytes come first,
        // all mixed up in a crazy order.  0x0A is 0b00001010, so the lowest
        // 3 bits are 0b010. With mixing (see Figure 3.18), this becomes:
        //    0b01000, 0b01011, 0b01000
        // repeated. These chunks come in repeated blocks of 0x33 (51) bytes.
        //
        // Because 51 * 5 is 255, there is one odd byte that is treated
        // specially at the beginning.
        //
        // Lower 3 bits of last byte:
        //    0b00010             = 0b00010 (02 -> AE)
        expect(track[i++]).toBe(0xAE);
        //
        // Bottom 3 bits in block 1 (08 block):
        //    0b01000 XOR 0b00010 = 0b01010 (0A -> BE)
        //    0b01000 XOR 0b01000 = 0b00000 (00 -> AB) x 50
        expect(track[i++]).toBe(0xBE);
        for (let j = 0; j < 50; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        //
        // Bottom 3 bits in block 2 (0B block):
        //    0b01011 XOR 0b01000 = 0b00011 (03 -> AF)
        //    0b01011 XOR 0b01011 = 0b00000 (00 -> AB) x 50
        expect(track[i++]).toBe(0xAF);
        for (let j = 0; j < 50; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        //
        // Bottom 3 bits in block 1 (08 block):
        //    0b01000 XOR 0b01011 = 0b00011 (03 -> AF)
        //    0b01000 XOR 0b01000 = 0b00000 (00 -> AB) x 50
        expect(track[i++]).toBe(0xAF);
        for (let j = 0; j < 50; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        // Upper 5 bits of 0x0A are 0x00001:
        //   0b00001 XOR 0b01000 = 0b01001 (09 -> BD)
        //   0b00001 XOR 0b00001 = 0b00000 (00 -> AB) x 255
        expect(track[i++]).toBe(0xBD);
        for (let j = 0; j < 255; j++) {
            expect(track[i++]).toBe(0xAB);
        }

        // checksum 0b00001 (01 -> AD)
        expect(track[i++]).toBe(0xAD);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Address Field for track 1, sector 0', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });
        const track = disk.tracks[1];
        let i = skipGap(track);
        // prologue
        i = expectSequence(track, i, [0xD5, 0xAA, 0xB5]);
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
        const disk = DOS13({
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

        // Expect data to be all 1s (track number).

        // In 5 x 3 encoding, the lowest 3 bits of all the bytes come first,
        // all mixed up in a crazy order.  0x01 is 0b00000001, so the lowest
        // 3 bits are 0b001. With mixing (see Figure 3.18), this becomes:
        //    0b00111, 0b00100, 0b00100
        // repeated. These chunks come in repeated blocks of 0x33 (51) bytes.
        //
        // Because 51 * 5 is 255, there is one odd byte that is treated
        // specially at the beginning.
        //
        // Lower 3 bits of last byte:
        //    0b00001             = 0b00001 (01 -> AD)
        expect(track[i++]).toBe(0xAD);
        //
        // Bottom 3 bits in block 1 (07 block):
        //    0b00111 XOR 0b00001 = 0b00110 (06 -> B7)
        //    0b00111 XOR 0b00111 = 0b00000 (00 -> AB) x 50
        expect(track[i++]).toBe(0xB7);
        for (let j = 0; j < 50; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        //
        // Bottom 3 bits in block 2 (04 block):
        //    0b00111 XOR 0b00100 = 0b00011 (03 -> AF)
        //    0b00100 XOR 0b00100 = 0b00000 (00 -> AB) x 50
        expect(track[i++]).toBe(0xAF);
        for (let j = 0; j < 50; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        //
        // Bottom 3 bits in block 1 (04 block):
        //    0b00100 XOR 0b00100 = 0b00011 (00 -> AB)
        //    0b00100 XOR 0b00100 = 0b00000 (00 -> AB) x 50
        expect(track[i++]).toBe(0xAB);
        for (let j = 0; j < 50; j++) {
            expect(track[i++]).toBe(0xAB);
        }
        // Upper 5 bits of 0x01 are 0x00000:
        //   0b00000 XOR 0b00100 = 0b00100 (04 -> B5)
        //   0b00000 XOR 0b00000 = 0b00000 (00 -> AB) x 255
        expect(track[i++]).toBe(0xB5);
        for (let j = 0; j < 255; j++) {
            expect(track[i++]).toBe(0xAB);
        }

        // checksum 0b00000 (00 -> AB)
        expect(track[i++]).toBe(0xAB);
        // epilogue
        i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
    });

    it('has correct Address Fields for all tracks', () => {
        // _Beneath Apple DOS_, TRACK FORMATTING, p. 3-12
        const disk = DOS13({
            name: 'test disk',
            data: BYTES_BY_TRACK,
            volume: 10,
            readOnly: true,
        });

        for (let t = 0; t < disk.tracks.length; t++) {
            // We essentially seek through the track for the Address Fields
            const track = disk.tracks[t];
            let i = findBytes(track, [0xD5, 0xAA, 0xB5]);
            for (let s = 0; s <= 12; s++) {
                // volume 10 = 0b00001010
                expect(track[i++]).toBe(0b10101111);
                expect(track[i++]).toBe(0b10101010);
                // convert track to 4x4 encoding
                const track4x4XX = ((t & 0b10101010) >> 1) | 0b10101010;
                const track4x4YY = (t & 0b01010101) | 0b10101010;
                expect(track[i++]).toBe(track4x4XX);
                expect(track[i++]).toBe(track4x4YY);
                // convert sector to 4x4 encoding
                const ss = D13O[s];
                const sector4x4XX = ((ss & 0b10101010) >> 1) | 0b10101010;
                const sector4x4YY = (ss & 0b01010101) | 0b10101010;
                expect(track[i++]).toBe(sector4x4XX);
                expect(track[i++]).toBe(sector4x4YY);
                // checksum
                expect(track[i++]).toBe(0b10101111 ^ track4x4XX ^ sector4x4XX);
                expect(track[i++]).toBe(0b10101010 ^ track4x4YY ^ sector4x4YY);
                // epilogue
                i = expectSequence(track, i, [0xDE, 0xAA, 0xEB]);
                // next sector
                i = findBytes(track, [0xD5, 0xAA, 0xB5], i);
            }
        }
    });
});