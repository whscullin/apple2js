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

import { explodeSector13, D13O } from './format_utils';

/**
 * Returns a `Disk` object from DOS 3.2-ordered image data.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function DOS13(options) {
    var { data, name, rawData, volume, readOnly } = options;
    var disk = {
        format: 'd13',
        name,
        volume,
        readOnly,
        tracks: [],
        trackMap: null,
        rawTracks: null
    };

    /*
     * DOS 13-sector disks have the physical sectors skewed on the track. The skew
     * between physical sectors is 10 (A), resulting in the following physical order:
     * 
     *   0 A 7 4 1 B 8 5 2 C 9 6 3
     * 
     * Note that because physical sector == logical sector, this works slightly
     * differently from the DOS and ProDOS nibblizers.
     */

    for (var t = 0; t < 35; t++) {
        var track = [];
        for (var disk_sector = 0; disk_sector < 13; disk_sector++) {
            var physical_sector = D13O[disk_sector];
            var sector;
            if (rawData) {
                var off = (13 * t + physical_sector) * 256;
                sector = new Uint8Array(rawData.slice(off, off + 256));
            } else {
                sector = data[t][physical_sector];
            }
            track = track.concat(
                explodeSector13(volume, t, physical_sector, sector)
            );
        }
        disk.tracks.push(track);
    }

    return disk;
}
