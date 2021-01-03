/* Copyright 2010-2019 Will Scullin <scullin@scullinsteel.com>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

import BlockVolume from './block';
import DOS from './do';
import Nibble from './nib';
import ProDOS from './po';

import { numToString, debug } from '../util';

/**
 * Returns a `Disk` object from a 2mg image.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function _2MG(options) {
    var OFFSETS = {
        CREATOR: 0x04,
        FLAGS: 0x0A,
        FORMAT: 0x0C,
        BLOCKS: 0x14,
        DATA_OFFSET: 0x18,
        BYTES: 0x1C,
    };

    var FLAGS = {
        READ_ONLY:    0x80000000,
        VOLUME_VALID: 0x00000100,
        VOLUME_MASK:  0x000000FF
    };

    var { rawData, arrayConstructor } = options;
    var disk;
    var volume = 254;

    // Standard header size is 64 bytes. Make assumptions.
    var prefix = new DataView(rawData);
    var signature = numToString(prefix.getInt32(0x0, true));
    if (signature !== '2IMG') {
        throw new Error('Unrecognized 2mg signature: ' + signature);
    }
    var creator = numToString(prefix.getInt32(OFFSETS.CREATOR, true));
    var format = prefix.getInt32(OFFSETS.FORMAT, true);
    var bytes = prefix.getInt32(OFFSETS.BYTES, true);
    var offset = prefix.getInt32(OFFSETS.DATA_OFFSET, true);
    var flags = prefix.getInt32(OFFSETS.FLAGS, true);
    var readOnly = (flags & FLAGS.READ_ONLY) !== 0;
    if (flags & FLAGS.VOLUME_VALID) {
        volume = flags & FLAGS.VOLUME_MASK;
    }

    debug('created by', creator);
    rawData = rawData.slice(offset, offset + bytes);

    var blockVolume = options.blockVolume || rawData.byteLength >= (800 * 1024);

    options = { rawData, readOnly, volume, arrayConstructor };

    if (blockVolume) {
        disk = new BlockVolume(options);
    } else {
        // Check image format.
        // Sure, it's really 64 bits. But only 2 are actually used.
        switch (format) {
            case 1: // PO
                disk = new ProDOS(options);
                break;
            case 2: // NIB
                disk = new Nibble(options);
                break;
            case 0: // dsk
            default:  // Something hinky, assume 'dsk'
                disk = new DOS(options);
                break;
        }
    }

    return disk;
}
