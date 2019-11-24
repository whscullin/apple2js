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
import { rom } from '../roms/cards/thunderclock';

export default function Thunderclock(io, slot)
{
    var LOC = {
        CONTROL: 0x80,
        AUX: 0x88
    };

    var FLAGS = {
        DATA: 0x01,
        CLOCK: 0x02,
        STROBE: 0x04
    };

    function _init() {
        debug('Thunderclock card in slot', slot);
    }

    var _command = 0;
    var _bits = [];

    function _calcbits() {
        function shift(val) {
            for (var idx = 0; idx < 4; idx++) {
                _bits.push((val & 0x08) !== 0);
                val <<= 1;
            }
        }
        function shiftBCD(val) {
            shift(parseInt(val / 10, 10));
            shift(parseInt(val % 10, 10));
        }

        var now = new Date();
        var day = now.getDate();
        var weekday = now.getDay();
        var month = now.getMonth() + 1;
        var hour = now.getHours();
        var minutes = now.getMinutes();
        var seconds = now.getSeconds();

        _bits = [];
        shift(month);
        shift(weekday);
        shiftBCD(day);
        shiftBCD(hour);
        shiftBCD(minutes);
        shiftBCD(seconds);
    }

    function _access(off, val) {
        switch (off & 0x8F) {
        case LOC.CONTROL:
            if (val !== undefined) {
                if ((val & FLAGS.STROBE) !== 0) {
                    if ((_command & 0x78) == 0x18) {
                        _calcbits();
                    }
                }
                _command = val;
            } else {
                if (_bits.pop()) {
                    _command |= 0x80;
                } else {
                    _command &= 0x7f;
                }
            }
            break;
        case LOC.AUX:
            break;
        }
        /*
        if (val === undefined) {
            debug("Read " + toHex(_command) + " from " + toHex(off))
        } else {
            debug("Wrote " + toHex(val) + " to " + toHex(off))
        }
        */
        return _command;
    }

    _init();

    return {
        read: function thunderclock_read(page, off) {
            var result;
            if (page < 0xc8) {
                result = rom[off];
            } else {
                result = rom[(page - 0xc8) << 8 | off];
            }
            return result;
        },
        write: function thunderclock_write() {
        },
        ioSwitch: function thunderclock_ioSwitch(off, val) {
            return _access(off, val);
        }
    };
}
