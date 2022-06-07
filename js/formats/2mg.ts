import DOS from './do';
import Nibble from './nib';
import ProDOS from './po';
import { DiskOptions } from './types';

import { numToString } from '../util';
import { ReadonlyUint8Array } from 'js/types';

/**
 * Offsets in bytes to the various header fields. All number fields are
 * in little-endian order (least significant byte first). These values
 * come from the spec at:
 * 
 * https://apple2.org.za/gswv/a2zine/Docs/DiskImage_2MG_Info.txt
 */
const OFFSETS = {
    /** File signature ('2IMG', 4 bytes) */
    SIGNATURE: 0x00,
    /** Creator ID (4 bytes) */
    CREATOR: 0x04,
    /** Header length (2 bytes) */
    HEADER_LENGTH: 0x08,
    /** Version number (2 bytes). (Version of what? Format? Image?). */
    VERSION: 0x0A,
    /** Image format ID (4 bytes) */
    FORMAT: 0x0C,
    /** Flags and DOS 3.3 volume number */
    FLAGS: 0x10,
    /**
     * Number of ProDOS blocks (4 bytes). ProDOS blocks are 512 bytes each.
     * This field must be zero if the image format is not 0x01 (ProDOS).
     * (ASIMOV2 always fills in this field.)
     */
    BLOCKS: 0x14,
    /**
     * Disk data start in bytes from the beginning of the image file
     * (4 bytes).
     */
    DATA_OFFSET: 0x18,
    /**
     * Length of disk data in bytes (4 bytes). (143,360 bytes for 5.25"
     * floppies; 512 × blocks for ProDOS volumes.)
     */
    DATA_LENGTH: 0x1C,
    /**
     * Comment start in bytes from the beginning of the image file (4 bytes).
     * Must be zero if there is no comment. The comment must come after the
     * disk data and before the creator data. The comment should be "raw text"
     * with no terminating null. By "raw text", we assume UTF-8.
     */
    COMMENT: 0x20,
    /**
     * Comment length in bytes (4 bytes). Must be zero if there is no comment.
     */
    COMMENT_LENGTH: 0x24,
    /**
     * Optional creator data start in bytes from the beginning of the image
     * file (4 bytes). Must be zero if there is no creator data.
     */
    CREATOR_DATA: 0x28,
    /**
     * Creator data length in bytes (4 bytes). Must be zero if there is no
     * creator data.
     */
    CREATOR_DATA_LENGTH: 0x2C,
    /** Padding (16 bytes). Must be zero. */
    PADDING: 0x30,
} as const;

const FLAGS = {
    READ_ONLY:    0x80000000,
    VOLUME_VALID: 0x00000100,
    VOLUME_MASK:  0x000000FF
} as const;

enum FORMAT {
    DOS = 0,
    ProDOS = 1,
    NIB = 2,
}

export function read2MGHeader(rawData: ArrayBuffer) {
    const prefix = new DataView(rawData);
    const signature = numToString(prefix.getInt32(OFFSETS.SIGNATURE, true));
    if (signature !== '2IMG') {
        throw new Error(`Unrecognized 2mg signature: ${signature}`);
    }
    const headerLength = prefix.getInt16(OFFSETS.HEADER_LENGTH, true);
    if (headerLength !== 64) {
        throw new Error(`2mg header length is incorrect ${headerLength} !== 63`);
    }
    const creator = numToString(prefix.getInt32(OFFSETS.CREATOR, true));
    const format = prefix.getInt32(OFFSETS.FORMAT, true);
    const flags = prefix.getInt32(OFFSETS.FLAGS, true);
    const blocks = prefix.getInt32(OFFSETS.BLOCKS, true);
    const offset = prefix.getInt32(OFFSETS.DATA_OFFSET, true);
    const bytes = prefix.getInt32(OFFSETS.DATA_LENGTH, true);
    const commentOffset = prefix.getInt32(OFFSETS.COMMENT, true);
    const commentLength = prefix.getInt32(OFFSETS.COMMENT_LENGTH, true);
    const creatorDataOffset = prefix.getInt32(OFFSETS.CREATOR_DATA, true);
    const creatorDataLength = prefix.getInt32(OFFSETS.CREATOR_DATA_LENGTH, true);

    // Though the spec says that it should be zero if the format is not
    // ProDOS, we don't check that since we know that it is violated.
    // However we do check that it's correct if the image _is_ ProDOS.
    if (format === FORMAT.ProDOS && blocks * 512 !== bytes) {
        throw new Error(`2mg blocks does not match disk data length: ${blocks} * 512 !== ${bytes}`);
    }
    if (offset < headerLength) {
        throw new Error(`2mg data offset is less than header length: ${offset} < ${headerLength}`);
    }
    if (offset + bytes > prefix.byteLength) {
        throw new Error(`2mg data extends beyond disk image: ${offset} + ${bytes} > ${prefix.byteLength}`);
    }
    const dataEnd = offset + bytes;
    if (commentOffset && commentOffset < dataEnd) {
        throw new Error(`2mg comment is before the end of the disk data: ${commentOffset} < ${offset} + ${bytes}`);
    }
    const commentEnd = commentOffset ? commentOffset + commentLength : dataEnd;
    if (commentEnd > prefix.byteLength) {
        throw new Error(`2mg comment extends beyond disk image: ${commentEnd} > ${prefix.byteLength}`);
    }
    if (creatorDataOffset && creatorDataOffset < commentEnd) {
        throw new Error(`2mg creator data is before the end of the comment: ${creatorDataOffset} < ${commentEnd}`);
    }
    const creatorDataEnd = creatorDataOffset ? creatorDataOffset + creatorDataLength : commentEnd;
    if (creatorDataEnd > prefix.byteLength) {
        throw new Error(`2mg creator data extends beyond disk image: ${creatorDataEnd} > ${prefix.byteLength}`);
    }

    const extras: { comment?: string; creatorData?: ReadonlyUint8Array } = {};
    if (commentOffset) {
        extras.comment = new TextDecoder('utf-8').decode(
            new Uint8Array(rawData, commentOffset, commentLength));
    }
    if (creatorDataOffset) {
        extras.creatorData = new Uint8Array(rawData, creatorDataOffset, creatorDataLength);
    }

    const readOnly = (flags & FLAGS.READ_ONLY) !== 0;
    let volume = 254;
    if (flags & FLAGS.VOLUME_VALID) {
        volume = flags & FLAGS.VOLUME_MASK;
    }

    return {
        bytes,
        creator,
        format,
        offset,
        readOnly,
        volume,
        ...extras
    };
}

/**
 * Returns a `Disk` object from a 2mg image.
 * @param options the disk image and options
 */
export default function createDiskFrom2MG(options: DiskOptions) {
    let { rawData } = options;
    let disk;

    if (!rawData) {
        throw new Error('Requires rawData');
    }

    const { bytes, format, offset, readOnly, volume } = read2MGHeader(rawData);
    rawData = rawData.slice(offset, offset + bytes);
    options = { ...options, rawData, readOnly, volume };

    // Check image format.
    // Sure, it's really 64 bits. But only 2 are actually used.
    switch (format) {
        case FORMAT.ProDOS: // PO
            disk = ProDOS(options);
            break;
        case FORMAT.NIB: // NIB
            disk = Nibble(options);
            break;
        case FORMAT.DOS: // dsk
        default:  // Something hinky, assume 'dsk'
            disk = DOS(options);
            break;
    }

    return disk;
}
