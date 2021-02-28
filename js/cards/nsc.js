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

export default function NoSlotClock(rom)
{
    var PATTERN = [
        0xC5, 0x3A, 0xA3, 0x5C, 0xC5, 0x3A, 0xA3, 0x5C
    ];
    var A0 = 0x01;
    var A2 = 0x04;

    function _init() {
        debug('NoSlotClock');
    }

    var _bits = [];
    var _pattern = new Array(64);
    var _patternIdx = 0;

    function _patternMatch() {
        for (var idx = 0; idx < 8; idx++) {
            var byte = 0;
            for (var jdx = 0; jdx < 8; jdx++) {
                byte >>= 1;
                byte |= _pattern.shift() ? 0x80 : 0x00;
            }
            if (byte !== PATTERN[idx]) {
                return false;
            }
        }
        return true;
    }

    function _calcBits() {
        function shift(val) {
            for (var idx = 0; idx < 4; idx++) {
                _bits.push(val & 0x08 ? 0x01 : 0x00);
                val <<= 1;
            }
        }
        function shiftBCD(val) {
            shift(parseInt(val / 10, 10));
            shift(parseInt(val % 10, 10));
        }

        var now = new Date();
        var year = now.getFullYear() % 100;
        var day = now.getDate();
        var weekday = now.getDay() + 1;
        var month = now.getMonth() + 1;
        var hour = now.getHours();
        var minutes = now.getMinutes();
        var seconds = now.getSeconds();
        var hundredths = (now.getMilliseconds() / 10);

        _bits = [];

        shiftBCD(year);
        shiftBCD(month);
        shiftBCD(day);
        shiftBCD(weekday);
        shiftBCD(hour);
        shiftBCD(minutes);
        shiftBCD(seconds);
        shiftBCD(hundredths);
    }

    _init();

    function _access(off) {
        if (off & A2) {
            _patternIdx = 0;
        } else {
            var bit = off & A0;
            _pattern[_patternIdx++] = bit;
            if (_patternIdx === 64) {
                if (_patternMatch()) {
                    _calcBits();
                }
                _patternIdx = 0;
            }
        }
    }

    return {
        start: function nsc_start()  {
            return rom.start();
        },

        end: function nsc_end() {
            return rom.end();
        },

        read: function nsc_read(page, off) {
            if (_bits.length > 0) {
                var bit = _bits.pop();
                return bit;
            } else {
                _access(off);
            }
            return rom.read(page, off);
        },

        write: function nsc_write(page, off, val) {
            _access(off);
            rom.write(page, off, val);
        },

        getState() {
            return {};
        },

        setState(_) {
        }
    };
}
