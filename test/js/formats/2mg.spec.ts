import {
    create2MGFragments,
    create2MGFromBlockDisk,
    FORMAT,
    HeaderData,
    read2MGHeader,
} from 'js/formats/2mg';
import { BlockDisk, MemoryBlockDisk } from 'js/formats/types';
import { concat } from 'js/util';
import { BYTES_BY_SECTOR_IMAGE } from './testdata/16sector';

const INVALID_SIGNATURE_IMAGE = new Uint8Array([0x11, 0x22, 0x33, 0x44]);

const INVALID_HEADER_LENGTH_IMAGE = new Uint8Array([
    // ID
    0x32, 0x49, 0x4d, 0x47,
    // Creator ID
    0x58, 0x47, 0x53, 0x21,
    // Header size
    0x0a, 0x00,
]);

const VALID_PRODOS_IMAGE = concat(
    new Uint8Array([
        // ID
        0x32, 0x49, 0x4d, 0x47,
        // Creator ID
        0x58, 0x47, 0x53, 0x21,
        // Header size
        0x40, 0x00,
        // Version number
        0x01, 0x00,
        // Image format (ProDOS)
        0x01, 0x00, 0x00, 0x00,
        // Flags
        0x00, 0x00, 0x00, 0x00,
        // ProDOS blocks
        0x18, 0x01, 0x00, 0x00,
        // Data offset
        0x40, 0x00, 0x00, 0x00,
        // Data length (in bytes)
        0x00, 0x30, 0x02, 0x00,
        // Comment offset
        0x00, 0x00, 0x00, 0x00,
        // Comment length
        0x00, 0x00, 0x00, 0x00,
        // Creator data offset
        0x00, 0x00, 0x00, 0x00,
        // Creator data length
        0x00, 0x00, 0x00, 0x00,
        // Padding
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ]),
    BYTES_BY_SECTOR_IMAGE
);

describe('2mg format', () => {
    describe('read2MGHeader', () => {
        it('throws if the signature is invalid', () => {
            expect(() => read2MGHeader(INVALID_SIGNATURE_IMAGE.buffer)).toThrow(
                /signature/
            );
        });

        it('throws if the header length is invalid', () => {
            expect(() =>
                read2MGHeader(INVALID_HEADER_LENGTH_IMAGE.buffer)
            ).toThrow(/header length/);
        });

        it('throws if block count is not correct for ProDOS image', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x14] = image[0x14] + 1;
            expect(() => read2MGHeader(image.buffer)).toThrow(/blocks/);
        });

        it('throws if comment comes before end of disk data', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x20] = 1;
            expect(() => read2MGHeader(image.buffer)).toThrow(/is before/);
        });

        it('throws if creator data comes before end of disk data', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x28] = 1;
            expect(() => read2MGHeader(image.buffer)).toThrow(/is before/);
        });

        it('throws if data length is too big for file', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x1d] += 2; // Increment byte length by 512
            image[0x14] += 1; // Increment block length by 1
            expect(() => read2MGHeader(image.buffer)).toThrow(/extends beyond/);
        });

        it('returns a header for a valid ProDOS image', () => {
            expect(read2MGHeader(VALID_PRODOS_IMAGE.buffer)).not.toBeNull();
        });

        it('returns a filled-in header for a valid ProDOS image', () => {
            const header = read2MGHeader(VALID_PRODOS_IMAGE.buffer);
            expect(header.creator).toBe('XGS!');
            expect(header.bytes).toBe(143_360);
            expect(header.offset).toBe(64);
            expect(header.format).toBe(1);
            expect(header.readOnly).toBeFalsy();
            expect(header.volume).toBe(0);
            expect(header.comment).toBeUndefined();
            expect(header.creatorData).toBeUndefined();
        });
    });

    describe('create2MGFragments', () => {
        it('creates a valid image from header data and blocks', () => {
            const header = read2MGHeader(VALID_PRODOS_IMAGE.buffer);
            const { prefix, suffix } = create2MGFragments(header, {
                blocks: header.bytes / 512,
            });
            expect(prefix).toEqual(VALID_PRODOS_IMAGE.slice(0, 64));
            expect(suffix).toEqual(new Uint8Array());
        });

        it('throws an error if block count does not match byte count', () => {
            const headerData: HeaderData = {
                creator: 'A2JS',
                bytes: 32768,
                format: FORMAT.ProDOS,
                readOnly: false,
                offset: 64,
                volume: 0,
            };
            expect(() =>
                create2MGFragments(headerData, { blocks: 63 })
            ).toThrow(/does not match/);
        });

        it('throws an error if not a ProDOS volume', () => {
            const headerData: HeaderData = {
                creator: 'A2JS',
                bytes: 143_360,
                format: FORMAT.DOS,
                readOnly: false,
                offset: 64,
                volume: 254,
            };
            expect(() =>
                create2MGFragments(headerData, { blocks: 280 })
            ).toThrow(/not supported/);
        });

        it('uses defaults', () => {
            const { prefix, suffix } = create2MGFragments(null, {
                blocks: 280,
            });
            const image = concat(prefix, BYTES_BY_SECTOR_IMAGE, suffix);
            const headerData = read2MGHeader(image.buffer);
            expect(headerData).toEqual({
                creator: 'A2JS',
                bytes: 143_360,
                format: FORMAT.ProDOS,
                readOnly: false,
                offset: 64,
                volume: 0,
            });
        });

        it.each([
            ['Hello, sailor', undefined],
            ['Hieyz wizka', new Uint8Array([4, 3, 2, 1])],
            [undefined, new Uint8Array([4, 3, 2, 1])],
        ])(
            'can create comment %p and creator data %p',
            (testComment, testData) => {
                const headerData: HeaderData = {
                    creator: 'A2JS',
                    bytes: 0,
                    format: FORMAT.ProDOS,
                    readOnly: false,
                    offset: 64,
                    volume: 254,
                };
                if (testComment) {
                    headerData.comment = testComment;
                }
                if (testData) {
                    headerData.creatorData = testData;
                }
                const { prefix, suffix } = create2MGFragments(headerData, {
                    blocks: 0,
                });
                const image = concat(prefix, suffix);
                const { comment, creatorData } = read2MGHeader(image.buffer);
                expect(comment).toEqual(testComment);
                expect(creatorData).toEqual(testData);
            }
        );
    });

    describe('create2MGFromBlockDisk', () => {
        it('can create a 2mg disk', async () => {
            const header = read2MGHeader(VALID_PRODOS_IMAGE.buffer);
            const blocks = [];
            for (let idx = 0; idx < BYTES_BY_SECTOR_IMAGE.length; idx += 512) {
                blocks.push(BYTES_BY_SECTOR_IMAGE.slice(idx, idx + 512));
            }
            const disk: BlockDisk = new MemoryBlockDisk(
                'hdv',
                { name: 'Good disk' },
                false,
                blocks
            );
            const image = await create2MGFromBlockDisk(header, disk);
            expect(VALID_PRODOS_IMAGE.buffer).toEqual(image);
        });
    });
});
