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

import { explodeSector16, DO } from './format_utils';
import { bytify } from '../util';
import { byte } from '../types';
import { NibbleDisk, DiskOptions, ENCODING_NIBBLE } from './types';

/**
 * Returns a `Disk` object from DOS-ordered image data.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function DOS(options: DiskOptions): NibbleDisk {
    const { data, name, rawData, volume, readOnly } = options;
    const disk: NibbleDisk = {
        format: 'dsk',
        encoding: ENCODING_NIBBLE,
        name,
        volume,
        readOnly,
        tracks: [],
    };

    for (let t = 0; t < 35; t++) {
        let track: byte[] = [];
        for (let physical_sector = 0; physical_sector < 16; physical_sector++) {
            const dos_sector = DO[physical_sector];
            let sector: Uint8Array;
            if (rawData) {
                const off = (16 * t + dos_sector) * 256;
                sector = new Uint8Array(rawData.slice(off, off + 256));
            } else if (data) {
                sector = new Uint8Array(data[t][dos_sector]);
            } else {
                throw new Error('Requires data or rawData');
            }
            track = track.concat(
                explodeSector16(volume, t, physical_sector, sector)
            );
        }
        disk.tracks[t] = bytify(track);
    }
    return disk;
}