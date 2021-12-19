import DOS from './do';
import Nibble from './nib';
import ProDOS from './po';
import { DiskOptions } from './types';

import { numToString, debug } from '../util';

const OFFSETS = {
    CREATOR: 0x04,
    FLAGS: 0x0A,
    FORMAT: 0x0C,
    BLOCKS: 0x14,
    DATA_OFFSET: 0x18,
    BYTES: 0x1C,
};

const FLAGS = {
    READ_ONLY:    0x80000000,
    VOLUME_VALID: 0x00000100,
    VOLUME_MASK:  0x000000FF
};

export function read2MGHeader(rawData: ArrayBuffer) {
    const prefix = new DataView(rawData);
    const signature = numToString(prefix.getInt32(0x0, true));
    if (signature !== '2IMG') {
        throw new Error('Unrecognized 2mg signature: ' + signature);
    }
    const creator = numToString(prefix.getInt32(OFFSETS.CREATOR, true));
    const format = prefix.getInt32(OFFSETS.FORMAT, true);
    const bytes = prefix.getInt32(OFFSETS.BYTES, true);
    const offset = prefix.getInt32(OFFSETS.DATA_OFFSET, true);
    const flags = prefix.getInt32(OFFSETS.FLAGS, true);
    const readOnly = (flags & FLAGS.READ_ONLY) !== 0;
    let volume = 254;
    if (flags & FLAGS.VOLUME_VALID) {
        volume = flags & FLAGS.VOLUME_MASK;
    }

    debug('created by', creator);

    return {
        bytes,
        creator,
        format,
        offset,
        readOnly,
        volume,
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
        case 1: // PO
            disk = ProDOS(options);
            break;
        case 2: // NIB
            disk = Nibble(options);
            break;
        case 0: // dsk
        default:  // Something hinky, assume 'dsk'
            disk = DOS(options);
            break;
    }

    return disk;
}
