import { read2MGHeader } from 'js/formats/2mg';
import { concat } from 'js/util';
import { BYTES_BY_SECTOR_IMAGE } from './testdata/16sector';

const INVALID_SIGNATURE_IMAGE = new Uint8Array([
    0x11, 0x22, 0x33, 0x44
]);

const INVALID_HEADER_LENGTH_IMAGE = new Uint8Array([
    // ID
    0x32, 0x49, 0x4d, 0x47,
    // Creator ID
    0x58, 0x47, 0x53, 0x21,
    // Header size
    0x0a, 0x00
]);

const VALID_PRODOS_IMAGE = concat(new Uint8Array([
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
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
]), BYTES_BY_SECTOR_IMAGE);

describe('2mg format', () => {
    describe('read2MGHeader', () => {
        it('throws if the signature is invalid', () => {
            expect(() => read2MGHeader(INVALID_SIGNATURE_IMAGE.buffer)).toThrow(/signature/);
        });

        it('throws if the header length is invalid', () => {
            expect(() => read2MGHeader(INVALID_HEADER_LENGTH_IMAGE.buffer)).toThrowError(/header length/);
        });

        it('throws if block count is not correct for ProDOS image', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x14] = image[0x14] + 1;
            expect(() => read2MGHeader(image.buffer)).toThrowError(/blocks/);
        });

        it('throws if comment comes before end of disk data', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x20] = 1;
            expect(() => read2MGHeader(image.buffer)).toThrowError(/is before/);
        });

        it('throws if creator data comes before end of disk data', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x28] = 1;
            expect(() => read2MGHeader(image.buffer)).toThrowError(/is before/);
        });

        it('throws if data length is too big for file', () => {
            const image = new Uint8Array(VALID_PRODOS_IMAGE);
            image[0x1D] += 2;  // Increment byte length by 512
            image[0x14] += 1;  // Increment block length by 1
            expect(() => read2MGHeader(image.buffer)).toThrowError(/extends beyond/);
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
            expect(header.volume).toBe(254);
            expect(header.comment).toBeUndefined();
            expect(header.creatorData).toBeUndefined();
        });
    });
});