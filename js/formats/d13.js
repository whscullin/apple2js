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

import { explodeSector13, _D13O } from './format_utils';

export default function Nibble(options) {
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

    for (var t = 0; t < 35; t++) {
        var track = [];
        for (var s = 0; s < 13; s++) {
            var sector;
            if (rawData) {
                var off = (13 * t + _D13O[s]) * 256;
                sector = new Uint8Array(rawData.slice(off, off + 256));
            } else {
                sector = data[t][_D13O[s]];
            }
            track = track.concat(
                explodeSector13(volume, t, _D13O[s], sector)
            );
        }
        disk.tracks.push(track);
    }

    return disk;
}
