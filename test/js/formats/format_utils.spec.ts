import createDiskFromDOS13 from 'js/formats/d13';
import createDiskFromDOS from 'js/formats/do';
import { defourXfour, DO, explodeSector13, findSector, fourXfour, readSector } from 'js/formats/format_utils';
import { BYTES_BY_SECTOR as BYTES_BY_SECTOR_13, BYTES_IN_ORDER as BYTES_IN_ORDER_13 } from './testdata/13sector';
import { BYTES_BY_SECTOR as BYTES_BY_SECTOR_16 } from './testdata/16sector';

describe('fourXfour', () => {
    //    d7 d6 d5 d4 d3 d2 d1 d0
    // =>  1 d7  1 d5  1 d3  1 d1
    //     1 d6  1 d4  1 d2  1 d0

    it('converts 0x00 correctly', () => {
        // 0000 0000 => 1010 1010, 1010 1010
        expect(fourXfour(0x00)).toEqual([0b1010_1010, 0b1010_1010]);
    });

    it('converts 0xff correctly', () => {
        // 1111 1111 => 1111 1111, 1111 1111
        expect(fourXfour(0xFF)).toEqual([0b1111_1111, 0b1111_1111]);
    });

    it('converts 0x55 correctly', () => {
        // 0101 0101 => 1010 1010, 1111 1111
        expect(fourXfour(0x55)).toEqual([0b1010_1010, 0b1111_1111]);
    });

    it('converts 0xAA correctly', () => {
        // 1010 1010 => 1111 1111, 1010 1010
        expect(fourXfour(0xAA)).toEqual([0b1111_1111, 0b1010_1010]);
    });

    it('converts 0xA5 correctly', () => {
        // 1010 0101 => 1111 1010, 1010 1111
        expect(fourXfour(0xA5)).toEqual([0b1111_1010, 0b1010_1111]);
    });

    it('converts 0x5A correctly', () => {
        // 0101 1010 => 1010 1111, 1111 1010
        expect(fourXfour(0x5A)).toEqual([0b1010_1111, 0b1111_1010]);
    });

    it('converts 0xC3 (0b1100_0011) correctly', () => {
        // 1100 0011 => 1110 1011, 1110 1011
        expect(fourXfour(0b1100_0011)).toEqual([0b1110_1011, 0b1110_1011]);
    });

    it('converts 0x3C (0b0011_1100) correctly', () => {
        // 0011 1100 => 1011 1110, 1011 1110
        expect(fourXfour(0b0011_1100)).toEqual([0b1011_1110, 0b1011_1110]);
    });
});

describe('defourXfour', () => {
    it('converts to 0x00 correctly', () => {
        //  1010 1010, 1010 1010 => 0000 0000
        expect(defourXfour(0b1010_1010, 0b1010_1010)).toEqual(0x00);
    });

    it('converts to 0xff correctly', () => {
        //  1111 1111, 1111 1111 => 1111 1111
        expect(defourXfour(0b1111_1111, 0b1111_1111)).toEqual(0xFF);
    });

    it('converts to 0x55 correctly', () => {
        //  1010 1010, 1111 1111 => 0101 0101
        expect(defourXfour(0b1010_1010, 0b1111_1111)).toEqual(0x55);
    });

    it('converts to 0xAA correctly', () => {
        //  1111 1111, 1010 1010 => 1010 1010
        expect(defourXfour(0b1111_1111, 0b1010_1010)).toEqual(0xAA);
    });

    it('converts to 0xA5 correctly', () => {
        //  1111 1010, 1010 1111 => 1010 0101
        expect(defourXfour(0b1111_1010, 0b1010_1111)).toEqual(0xA5);
    });

    it('converts to 0x5A correctly', () => {
        //  1010 1111, 1111 1010 => 0101 1010
        expect(defourXfour(0b1010_1111, 0b1111_1010)).toEqual(0x5A);
    });

    it('converts to 0xC3 (0b1100_0011) correctly', () => {
        //  1110 1011, 1110 1011 => 1100 0011
        expect(defourXfour(0b1110_1011, 0b1110_1011)).toEqual(0b1100_0011);
    });

    it('converts to 0x3C (0b0011_1100) correctly', () => {
        //  1011 1110, 1011 1110 => 0011 1100
        expect(defourXfour(0b1011_1110, 0b1011_1110)).toEqual(0b0011_1100);
    });
});

describe('findSector', () => {
    describe('for a 16 sector DOS disk', () => {
        it('correctly finds track 0, sector 0', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 0, 0);
            expect(track).toBe(0);
            expect(sector).toBe(0);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */);
            expect(sectors).toBe(16);
        });

        it('correctly finds track 0, sector 1', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 0, 1);
            expect(track).toBe(0);
            expect(sector).toBe(1);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 1 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 342 /* data 6 & 2 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 41 /* GAP3 nibbles for track 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(16);
        });

        it('correctly finds track 0, sector 2', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 0, 2);
            expect(track).toBe(0);
            expect(sector).toBe(2);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 2 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 342 /* data 6 & 2 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 41 /* GAP3 nibbles for track 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(16);
        });

        it('correctly finds track 0, sector 15', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 0, 15);
            expect(track).toBe(0);
            expect(sector).toBe(15);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 15 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 342 /* data 6 & 2 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 41 /* GAP3 nibbles for track 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(16);
        });

        it('correctly finds track 1, sector 0', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 1, 0);
            expect(track).toBe(1);
            expect(sector).toBe(0);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */);
            expect(sectors).toBe(16);
        });

        it('correctly finds track 1, sector 1', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 1, 1);
            expect(track).toBe(1);
            expect(sector).toBe(1);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 1 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 342 /* data 6 & 2 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 39 /* GAP3 nibbles for track > 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(16);
        });

        it('correctly finds track 1, sector 15', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 1, 15);
            expect(track).toBe(1);
            expect(sector).toBe(15);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 15 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 342 /* data 6 & 2 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 39 /* GAP3 nibbles for track > 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(16);
        });
    });

    describe('for a 13 sector disk', () => {
        it('correctly finds track 0, sector 0 of a 13 sector disk', () => {
            const disk = createDiskFromDOS13({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_13,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 0, 0);
            expect(track).toBe(0);
            expect(sector).toBe(0);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */);
            expect(sectors).toBe(13);
        });

        it('correctly finds track 0, sector 1 of a 13 sector disk', () => {
            const disk = createDiskFromDOS13({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_13,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 0, 1);
            expect(track).toBe(0);
            expect(sector).toBe(1);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 4 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 410 /* data 5 & 3 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 41 /* GAP3 nibbles for track 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(13);
        });

        it('correctly finds track 1, sector 6 of a 13 sector disk', () => {
            const disk = createDiskFromDOS13({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_13,
                readOnly: true,
            });
            const { nibble, track, sector, sectors } = findSector(disk, 1, 6);
            expect(track).toBe(1);
            expect(sector).toBe(6);
            expect(nibble).toBe(
                128 /* GAP1 nibbles */
                + 11 * (
                    + 14 /* Address Field nibbles */
                    + 5 /* GAP2 nibbles */
                    + 3 /* prologue nibbles */
                    + 410 /* data 5 & 3 */
                    + 1 /* checksum nibble */
                    + 3 /* epilogue nibbles */
                    + 39 /* GAP3 nibbles for track > 0 */)
                + 14 /* Address Field nibbles */
                + 5 /* GAP2 nibbles */
                + 3 /* prologue nibbles */
            );
            expect(sectors).toBe(13);
        });
    });
});

describe('readSector', () => {
    describe('for a 16 sector disk', () => {
        it('correctly reads track 0, sector 0', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const data = readSector(disk, 0, 0);
            expect(data).toEqual(new Uint8Array(256));
        });

        it('correctly reads track 0, sector 1', () => {
            const disk = createDiskFromDOS({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_16,
                readOnly: true,
            });
            const data = readSector(disk, 0, 1);
            expect(data).toEqual(new Uint8Array(256).fill(DO[1]));
        });
    });

    describe('for a 13 sector disk', () => {
        it('correctly reads track 0, sector 0', () => {
            const disk = createDiskFromDOS13({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_13,
                readOnly: true,
            });
            const data = readSector(disk, 0, 0);
            expect(data).toEqual(new Uint8Array(256));
        });

        it('correctly reads track 0, sector 1', () => {
            const disk = createDiskFromDOS13({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_BY_SECTOR_13,
                readOnly: true,
            });
            const data = readSector(disk, 0, 1);
            expect(data).toEqual(new Uint8Array(256).fill(1));
        });

        it('correctly reads track 0, sector 0 bytes in order', () => {
            const disk = createDiskFromDOS13({
                name: 'Disk by sector',
                volume: 254,
                data: BYTES_IN_ORDER_13,
                readOnly: true,
            });
            const data = readSector(disk, 0, 0);
            const expected = new Uint8Array(256);
            for (let i = 0; i < 256; i++) {
                expected[i] = i;
            }
            expect(data).toEqual(expected);
        });
    });

});

describe('explodeSector13', () => {
    it('correctly encodes all 1s', () => {
        const sector = explodeSector13(256, 0, 0, new Uint8Array(256).fill(1));
        expect(sector[0]).toBe(0xFF);
        // Address prologue
        expect(sector[0x80]).toBe(0xD5);
        expect(sector[0x81]).toBe(0xAA);
        expect(sector[0x82]).toBe(0xB5);

        // Data prologue
        expect(sector[0x93]).toBe(0xD5);
        expect(sector[0x94]).toBe(0xAA);
        expect(sector[0x95]).toBe(0xAD);

        // Data
        expect(sector[0x96]).toBe(0xAD); // 01 special low bit of 0xFF
        expect(sector[0x97]).toBe(0xB7); // C:001 D0:1 E0:1 -> 07 -> 07 ^ 01 -> 06 -> B7
        expect(sector[0x98]).toBe(0xAB); // G:001 H0:1 I0:1 -> 07 -> 07 ^ 07 -> 00 -> AB
        expect(sector[0x99]).toBe(0xAB); // J:001 K0:1 L0:1 -> 07 -> 07 ^ 07 -> 00 -> AB
        for (let i = 0x9A; i <= 0x96 + 0x33; i++) {
            expect(sector[i]).toBe(0xAB); // same as above
        }

        expect(sector[0x96 + 0x34]).toBe(0xAF); // B:001 D1:0 E1:0 -> 04 ^ 07 -> 03 -> AF
        expect(sector[0x96 + 0x35]).toBe(0xAB); // X:001 Y1:0 Z1:0 -> 04 ^ 04 -> 00 -> AB
        for (let i = 0x96 + 0x36; i <= 0x96 + 0x33 + 0x33; i++) {
            expect(sector[i]).toBe(0xAB); // same as above
        }

        // expect(sector[0x98]).toBe(0xAB); // B:001 D1:0 E1:0 -> 04 -> 04 ^ 07 -> 03 -> AF
        // expect(sector[0x97]).toBe(0xB7); // A:001 D2:0 E2:0 -> 04 -> 04 ^ 02 -> 06 -> B7
    });
});

describe('test', () => {
    it('5-bit nibble to data offset', () => {
        // const off = (i: number) => 0x33 * (i % 5) + (0x32 - Math.floor(i / 5));
        const off = (i: number) => Math.floor(i / 0x33) + 5 * (0x32 - (i % 0x33));
        expect(off(0x32)).toBe(0);
        expect(off(0x31)).toBe(5);
        expect(off(0x30)).toBe(10);
        expect(off(0x65)).toBe(1);
        expect(off(0x64)).toBe(6);
        expect(off(0x63)).toBe(11);
        expect(off(0x98)).toBe(2);
        expect(off(0x97)).toBe(7);
        expect(off(0x96)).toBe(12);
        expect(off(0xCB)).toBe(3);
        expect(off(0xCA)).toBe(8);
        expect(off(0xC9)).toBe(13);
        expect(off(0xFE)).toBe(4);
        expect(off(0xFD)).toBe(9);
        expect(off(0xFC)).toBe(14);

        const seen = new Set<number>();
        for (let i = 0; i < 0xFF; i++) {
            seen.add(off(i));
        }
        for (let i = 0; i < 0xFF; i++) {
            expect(seen).toContain(i);
        }
    });
    it('3-bit nibble to data offset', () => {
        // const off = 0x33 * (i % 3) + (0x32 - Math.floor(i / 3));
        // const off = (i: number) => Math.floor(i / 0x33) + 3 * (0x32 - (i % 0x33));
        const off = (i: number) => Math.floor(i / 0x33) + 5 * (0x32 - (i % 0x33));
        const dOff = (i: number) => 3 + 5 * (0x32 - (i % 0x33));
        const eOff = (i: number) => 4 + 5 * (0x32 - (i % 0x33));
        const bit = (i: number) => 2 - Math.floor(i / 0x33);
        expect(off(0x32)).toBe(0);
        expect(dOff(0x32)).toBe(3);
        expect(eOff(0x32)).toBe(4);
        expect(bit(0x32)).toBe(2);

        expect(off(0x65)).toBe(1);
        expect(dOff(0x65)).toBe(3);
        expect(eOff(0x65)).toBe(4);
        expect(bit(0x65)).toBe(1);

        expect(off(0x98)).toBe(2);
        expect(dOff(0x98)).toBe(3);
        expect(eOff(0x98)).toBe(4);
        expect(bit(0x98)).toBe(0);

        expect(off(0x31)).toBe(5);
        expect(dOff(0x31)).toBe(8);
        expect(eOff(0x31)).toBe(9);

        expect(off(0x64)).toBe(6);
        expect(dOff(0x64)).toBe(8);
        expect(eOff(0x64)).toBe(9);

        expect(off(0x97)).toBe(7);
        expect(dOff(0x97)).toBe(8);
        expect(eOff(0x97)).toBe(9);

        expect(off(0x30)).toBe(10);
        expect(dOff(0x30)).toBe(13);
        expect(eOff(0x30)).toBe(14);

        const seen = new Set<number>();
        for (let i = 0; i < 0x99; i++) {
            seen.add(off(i));
            seen.add(dOff(i));
            seen.add(eOff(i));
        }
        for (let i = 0; i < 0xFF; i++) {
            expect(seen).toContain(i);
        }
    });
});
