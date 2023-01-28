import {
    isNibbleDisk,
    isNibbleDiskFormat,
    isBlockDiskFormat,
    isWozDisk,
    DiskFormat,
    NibbleDisk,
    WozDisk,
} from 'js/formats/types';

const nibbleDisk = {
    encoding: 'nibble'
} as NibbleDisk;

const wozDisk = {
    encoding: 'bitstream'
} as WozDisk;

describe('Format types', () => {
    describe('isNibbleDisk', () => {
        it.each([
            [nibbleDisk, true],
            [wozDisk, false],
        ])('%s is %s', (disk, value) => {
            expect(isNibbleDisk(disk)).toEqual(value);
        });
    });

    describe('isNibbleDiskFormat', () => {
        it.each([
            ['2mg', true],
            ['d13', true],
            ['do', true],
            ['dsk', true],
            ['po', true],
            ['nib', true],
            ['hdv', false],
        ])('%s is %s', (fmt, val) => {
            expect(isNibbleDiskFormat(fmt as DiskFormat)).toEqual(val);
        });
    });

    describe('isBlockDiskFormat', () => {
        it.each([
            ['2mg', true],
            ['d13', false],
            ['do', false],
            ['dsk', false],
            ['po', true],
            ['nib', false],
            ['hdv', true],
        ])('%s is %s', (fmt, val) => {
            expect(isBlockDiskFormat(fmt as DiskFormat)).toEqual(val);
        });
    });

    describe('isWozDisk', () => {
        it.each([
            [nibbleDisk, false],
            [wozDisk, true],
        ])('%s is %s', (disk, value) => {
            expect(isWozDisk(disk)).toEqual(value);
        });
    });
});
