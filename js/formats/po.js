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

import { explodeSector16, _PO } from './format_utils';
import { bytify } from '../util';

export default function ProDOS(options) {
    var { data, name, rawData, volume, readOnly } = options;
    var disk = {
        format: 'nib',
        name,
        volume: volume || 254,
        tracks: [],
        readOnly: readOnly || false,
        trackMap: null,
        rawTracks: null
    };

    for (var t = 0; t < 35; t++) {
        var track = [];
        for (var s = 0; s < 16; s++) {
            var sector;
            if (rawData) {
                var off = (16 * t + s) * 256;
                sector = new Uint8Array(rawData.slice(off, off + 256));
            } else {
                sector = data[t][s];
            }
            track = track.concat(
                explodeSector16(volume, t, _PO[s], sector)
            );
        }
        disk.tracks[t] = bytify(track);
    }

    return disk;
}
