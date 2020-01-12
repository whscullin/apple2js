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

import { debug, toHex } from '../util';
import { P7, P8A } from '../roms/cards/serial';

export default function Serial(io, cbs) {

    debug('Serial card');
    var SWITCHES = [
        0, // SW1 Baud bit 0
        0, // SW2 Baud bit 1
        0, // SW3 Baud bit 2  000 - 19200
        1, // SW4 CR Delay      1 - Disabled
        1, // SW5 Width bit 0
        1, // SW6 Width bit 1  11 - 40 Columns
        1, // SW7 Line feed     1 - Disabled
    ];

    var LOC = {
        STATUS: 0x80,
        DATA_1: 0x81,
        DATA_0: 0x82
    };

    function init() {
        debug('Serial Card');
    }

    function _access(off, val) {
        var nextBit = 1;
        var result = undefined;
        if (val === undefined) {
            result = 0;
            for (var idx = 0; idx < 7; idx++) {
                result >>= 1;
                result |= SWITCHES[idx] ? 0x80 : 0;
            }
            result >>= 1;
            result |= nextBit ? 0x80 : 0;

            switch (off & 0x83) {
            case LOC.STATUS:
                break;
            case LOC.DATA_1:
                debug('xmit 1');
                break;
            case LOC.DATA_0:
                debug('xmit 0');
                break;
            default:
                debug('Serial card unknown soft switch', toHex(off));
            }
        } else {
            debug('Serial card write to', toHex(off), toHex(val));
        }

        return result;
    }

    init();

    return {
        ioSwitch: function (off, val) {
            return _access(off, val);
        },
        read: function(page, off) {
            if (page < 0xC8) {
                return P7[off];
            } else {
                return P8A[((page % 2) << 8) | off];
            }
        },
        write: function() {}
    };
}
