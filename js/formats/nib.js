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

/**
 * Returns a `Disk` object from raw nibble image data.
 * @param {*} options the disk image and options
 * @returns {import('./format_utils').Disk}
 */
export default function Nibble(options) {
    var { data, name, rawData, volume, readOnly } = options;
    var disk = {
        format: 'nib',
        name,
        volume: volume || 254,
        readOnly: readOnly || false,
        tracks: [],
        trackMap: null,
        rawTracks: null
    };

    for (var t = 0; t < 35; t++) {
        var track;
        if (rawData) {
            var off = t * 0x1a00;
            track = new Uint8Array(data.slice(off, off + 0x1a00));
        } else {
            track = data[t];
        }
        disk.tracks[t] = track;
    }

    return disk;
}
