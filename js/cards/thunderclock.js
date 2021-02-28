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
import { rom } from '../roms/cards/thunderclock';

export default function Thunderclock()
{
    var LOC = {
        CONTROL: 0x80,
        AUX: 0x88
    };

    var COMMANDS = {
        MASK: 0x18,
        REGHOLD: 0x00,
        REGSHIFT: 0x08,
        TIMED: 0x18
    };

    var FLAGS = {
        DATA: 0x01,
        CLOCK: 0x02,
        STROBE: 0x04
    };

    function _init() {
        debug('Thunderclock');
    }

    var _clock = false;
    var _strobe = false;
    var _shiftMode = false;
    var _register = 0;
    var _bits = [];
    var _command = COMMANDS.HOLD;

    function _debug() {
        // debug.apply(this, arguments);
    }

    function _calcBits() {
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

    function _shift() {
        if (_shiftMode) {
            if (_bits.pop()) {
                _debug('shifting 1');
                _register |= 0x80;
            } else {
                _debug('shifting 0');
                _register &= 0x7f;
            }
        }
    }

    function _access(off, val) {
        switch (off & 0x8F) {
            case LOC.CONTROL:
                if (val !== undefined) {
                    var strobe = val & FLAGS.STROBE ? true : false;
                    if (strobe !== _strobe) {
                        _debug('strobe', _strobe ? 'high' : 'low');
                        if (strobe) {
                            _command = val & COMMANDS.MASK;
                            switch (_command) {
                                case COMMANDS.TIMED:
                                    _debug('TIMED');
                                    _calcBits();
                                    break;
                                case COMMANDS.REGSHIFT:
                                    _debug('REGSHIFT');
                                    _shiftMode = true;
                                    _shift();
                                    break;
                                case COMMANDS.REGHOLD:
                                    _debug('REGHOLD');
                                    _shiftMode = false;
                                    break;
                                default:
                                    _debug('Unknown command', toHex(_command));
                            }
                        }
                    }

                    var clock = val & FLAGS.CLOCK ? true : false;

                    if (clock !== _clock) {
                        _clock = clock;
                        _debug('clock', _clock ? 'high' : 'low');
                        if (clock) {
                            _shift();
                        }
                    }
                }
                break;
            case LOC.AUX:
                break;
        }
        return _register;
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
        },
        getState() {
            return {};
        },
        setState(_) {}
    };
}
