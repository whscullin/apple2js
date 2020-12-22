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

/**
 * Returns a `Disk` object from DOS-ordered image data.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function DOS(options) {
    var { data, name, rawData, volume, readOnly } = options;
    var disk = {
        format: 'dsk',
        name,
        volume,
        readOnly,
        tracks: [],
        trackMap: null,
        rawTracks: null
    };

    for (var t = 0; t < 35; t++) {
        var track = [];
        for (var physical_sector = 0; physical_sector < 16; physical_sector++) {
            const dos_sector = DO[physical_sector];
            var sector;
            if (rawData) {
                const off = (16 * t + dos_sector) * 256;
                sector = new Uint8Array(rawData.slice(off, off + 256));
            } else {
                sector = data[t][dos_sector];
            }
            track = track.concat(
                explodeSector16(volume, t, physical_sector, sector)
            );
        }
        disk.tracks[t] = bytify(track);
    }
    return disk;
}
