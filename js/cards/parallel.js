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

import { debug } from '../util';
import { rom } from '../roms/cards/parallel';

export default function Parallel(io, cbs) {

    debug('Parallel card');

    var LOC = {
        IOREG: 0x80
    };

    function _access(off, val) {
        switch (off & 0x8f) {
            case LOC.IOREG:
                if (cbs.putChar && val) {
                    cbs.putChar(val);
                }
                break;
            default:
                debug('Parallel card unknown softswitch', off);
        }
    }

    return {
        ioSwitch: function (off, val) {
            return _access(off, val);
        },
        read: function(page, off) {
            return rom[off];
        },
        write: function() {},
        getState() {
            return {};
        },
        setState(_) {}
    };
}
