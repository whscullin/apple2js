import { BYTES_BY_SECTOR, BYTES_BY_TRACK, BYTES_IN_ORDER } from './13sector';

describe('BYTES_IN_ORDER', () => {
    it('has the correct bytes in track 0, sector 0, byte 0 and byte 1', () => {
        const disk = BYTES_IN_ORDER;
        expect(disk[0][0][0]).toBe(0);
        expect(disk[0][0][1]).toBe(1);
    });

    it('has the correct bytes in track 0, sector 0', () => {
        const disk = BYTES_IN_ORDER;
        for (let i = 0; i < 256; i++) {
            expect(disk[0][0][i]).toBe(i);
        }
    });

    it('has the correct bytes in track 1, sector 0', () => {
        const disk = BYTES_IN_ORDER;
        for (let i = 0; i < 256; i++) {
            expect(disk[1][0][i]).toBe(i);
        }
    });

    it('has the correct bytes in track 30, sector 11', () => {
        const disk = BYTES_IN_ORDER;
        for (let i = 0; i < 256; i++) {
            expect(disk[30][11][i]).toBe(i);
        }
    });
});

describe('BYTES_BY_SECTOR', () => {
    it('has the correct bytes in track 0, sector 0, byte 0 and byte 1', () => {
        const disk = BYTES_BY_SECTOR;
        expect(disk[0][0][0]).toBe(0);
        expect(disk[0][0][1]).toBe(0);
    });

    it('has the correct bytes in track 0, sector 0', () => {
        const disk = BYTES_BY_SECTOR;
        for (let i = 0; i < 256; i++) {
            expect(disk[0][0][i]).toBe(0);
        }
    });

    it('has the correct bytes in track 1, sector 0', () => {
        const disk = BYTES_BY_SECTOR;
        for (let i = 0; i < 256; i++) {
            expect(disk[1][0][i]).toBe(0);
        }
    });

    it('has the correct bytes in track 30, sector 11', () => {
        const disk = BYTES_BY_SECTOR;
        for (let i = 0; i < 256; i++) {
            expect(disk[30][11][i]).toBe(11);
        }
    });
});

describe('BYTES_BY_TRACK', () => {
    it('has the correct bytes in track 0, sector 0, byte 0 and byte 1', () => {
        const disk = BYTES_BY_TRACK;
        expect(disk[0][0][0]).toBe(0);
        expect(disk[0][0][1]).toBe(0);
    });

    it('has the correct bytes in track 0, sector 0', () => {
        const disk = BYTES_BY_TRACK;
        for (let i = 0; i < 256; i++) {
            expect(disk[0][0][i]).toBe(0);
        }
    });

    it('has the correct bytes in track 1, sector 0', () => {
        const disk = BYTES_BY_TRACK;
        for (let i = 0; i < 256; i++) {
            expect(disk[1][0][i]).toBe(1);
        }
    });

    it('has the correct bytes in track 30, sector 11', () => {
        const disk = BYTES_BY_TRACK;
        for (let i = 0; i < 256; i++) {
            expect(disk[30][11][i]).toBe(30);
        }
    });
});