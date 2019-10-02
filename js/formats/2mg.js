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

import DOS from './do';
import Nibble from './nib';
import ProDOS from './po';

export default function _2MG(options) {
    var { rawData } = options;
    var disk;
    var volume = 254;

    // Standard header size is 64 bytes. Make assumptions.
    var prefix = new Uint8Array(rawData.slice(0, 64));
    rawData = rawData.slice(64);
    var flags =
        prefix[0x10] |
        (prefix[0x11] << 8) |
        (prefix[0x12] << 16) |
        (prefix[0x13] << 24);
    var readOnly = (flags & 0x80000000) !== 0;
    if ((flags & 0x10) !== 0) {
        volume = flags & 0xff;
    }

    options = { rawData, readOnly, volume };

    // Check image format.
    // Sure, it's really 64 bits. But only 2 are actually used.
    switch (prefix[0xc]) {
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


    return disk;
}
