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

import { NibbleDisk, DiskOptions } from './types';
import { memory } from '../types';

/**
 * Returns a `Disk` object from raw nibble image data.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function Nibble(options: DiskOptions) {
    const { data, name, rawData, volume, readOnly } = options;
    const disk: NibbleDisk = {
        format: 'nib',
        encoding: 'nibble',
        name,
        volume: volume || 254,
        readOnly: readOnly || false,
        tracks: []
    };

    for (let t = 0; t < 35; t++) {
        let track: memory;
        if (rawData) {
            const off = t * 0x1a00;
            track = new Uint8Array(rawData.slice(off, off + 0x1a00));
        } else if (data) {
            track = data[t][0];
        } else {
            throw new Error('Requires data or rawData');
        }
        disk.tracks[t] = track;
    }

    return disk;
}
